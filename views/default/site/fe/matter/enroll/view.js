'use strict';
require('../../../../../../asset/css/buttons.css');
require('./view.css');

require('../../../../../../asset/js/xxt.ui.schema.js');
require('./_asset/ui.round.js');

window.moduleAngularModules = ['round.ui.enroll', 'schema.ui.xxt'];

var ngApp = require('./main.js');
ngApp.factory('Record', ['http2', 'tmsLocation', function (http2, LS) {
    var Record, _ins, _deferredRecord;
    Record = function (oApp) {
        var data = {}; // 初始化空数据，优化加载体验
        oApp.dynaDataSchemas.forEach(function (schema) {
            data[schema.id] = '';
        });
        this.current = {
            enroll_at: 0,
            data: data
        };
    };
    Record.prototype.remove = function (record) {
        var url;
        url = LS.j('record/remove', 'site', 'app');
        url += '&ek=' + record.enroll_key;
        return http2.get(url);
    };
    return {
        ins: function (oApp) {
            if (_ins) {
                return _ins;
            }
            _ins = new Record(oApp);
            return _ins;
        }
    };
}]);
ngApp.controller('ctrlRecord', ['$scope', 'Record', 'tmsLocation', '$parse', '$sce', 'noticebox', function ($scope, Record, LS, $parse, $sce, noticebox) {
    $scope.value2Label = function (schemaId) {
        var val, oRecord;
        if (schemaId && $scope.Record) {
            oRecord = $scope.Record.current;
            if (oRecord && oRecord.data) {
                val = $parse(schemaId)(oRecord.data);
                return val ? $sce.trustAsHtml(val) : '';
            }
        }
        return '';
    };
    $scope.score2Html = function (schemaId) {
        var oSchema, val, oRecord, label;
        if ($scope.Record) {
            if (oSchema = $scope.app._schemasById[schemaId]) {
                label = '';
                oRecord = $scope.Record.current;
                if (oRecord && oRecord.data && oRecord.data[schemaId]) {
                    val = oRecord.data[schemaId];
                    if (oSchema.ops && oSchema.ops.length) {
                        oSchema.ops.forEach(function (op, index) {
                            label += '<div>' + op.l + ': ' + (val[op.v] ? val[op.v] : 0) + '</div>';
                        });
                    }
                }
                return $sce.trustAsHtml(label);
            }
        }
        return '';
    };
}]);
ngApp.controller('ctrlView', ['$scope', '$sce', '$parse', 'tmsLocation', 'http2', 'noticebox', 'Record', 'picviewer', '$timeout', 'tmsSchema', 'enlRound', function ($scope, $sce, $parse, LS, http2, noticebox, Record, picviewer, $timeout, tmsSchema, enlRound) {
    function fnHidePageActions() {
        var domActs, domAct;
        if (domActs = document.querySelectorAll('[wrap=button]')) {
            angular.forEach(domActs, function (domAct) {
                domAct.style.display = 'none';
            });
        }
    }

    function fnGetRecord(ek) {
        if (ek) {
            return http2.get(LS.j('record/get', 'site', 'app') + '&ek=' + ek);
        } else {
            return http2.get(LS.j('record/get', 'site', 'app', 'ek', 'rid'));
        }
    }

    function fnGetRecordByRound(oRound) {
        return http2.get(LS.j('record/get', 'site', 'app') + '&rid=' + oRound.rid);
    }

    function fnProcessData(oRecord) {
        var oRecData, originalValue, afterValue;
        oRecData = oRecord.data;
        if (oRecData && Object.keys(oRecData).length) {
            _oApp.dynaDataSchemas.forEach(function (oSchema) {
                originalValue = $parse(oSchema.id)(oRecData);
                if (originalValue) {
                    switch (oSchema.type) {
                        case 'longtext':
                            afterValue = tmsSchema.txtSubstitute(originalValue);
                            break;
                        case 'single':
                            if (oSchema.ops && oSchema.ops.length) {
                                for (var i = oSchema.ops.length - 1; i >= 0; i--) {
                                    if (originalValue === oSchema.ops[i].v) {
                                        afterValue = oSchema.ops[i].l;
                                    }
                                }
                            }
                            break;
                        case 'multiple':
                            originalValue = originalValue.split(',');
                            if (oSchema.ops && oSchema.ops.length) {
                                afterValue = [];
                                oSchema.ops.forEach(function (op) {
                                    originalValue.indexOf(op.v) !== -1 && afterValue.push(op.l);
                                });
                                afterValue = afterValue.length ? afterValue.join(',') : '[空]';
                            }
                            break;
                        case 'url':
                            originalValue._text = tmsSchema.urlSubstitute(originalValue);
                            break;
                        default:
                            afterValue = originalValue;
                    }
                }

                $parse(oSchema.id).assign(oRecData, (afterValue || originalValue || (/image|file|voice|multitext/.test(oSchema.type) ? '' : '[空]')));

                afterValue = undefined;
            });
        }
    }

    function fnDisableActions() {
        var domActs, domAct;
        if (domActs = document.querySelectorAll('button[ng-click]')) {
            angular.forEach(domActs, function (domAct) {
                var ngClick = domAct.getAttribute('ng-click');
                if (ngClick.indexOf('editRecord') === 0 || ngClick.indexOf('removeRecord') === 0) {
                    domAct.style.display = 'none';
                }
            });
        }
    }
    /**
     * 控制轮次题目的可见性
     */
    function fnToggleRoundSchemas(dataSchemas, oRecordData) {
        dataSchemas.forEach(function (oSchema) {
            var domSchema;
            domSchema = document.querySelector('[wrap=value][schema="' + oSchema.id + '"]');
            if (domSchema && oSchema.hideByRoundPurpose && oSchema.hideByRoundPurpose.length) {
                var bVisible;
                bVisible = true;
                if (oSchema.hideByRoundPurpose.indexOf($scope.Record.current.round.purpose) !== -1) {
                    bVisible = false;
                }
                oSchema._visible = bVisible;
                domSchema.classList.toggle('hide', !bVisible);
            }
        });
    }
    /**
     * 控制关联题目的可见性
     */
    function fnToggleAssocSchemas(dataSchemas, oRecordData) {
        dataSchemas.forEach(function (oSchema) {
            var domSchema;
            domSchema = document.querySelector('[wrap=value][schema="' + oSchema.id + '"]');
            if (domSchema && oSchema.visibility && oSchema.visibility.rules && oSchema.visibility.rules.length) {
                var bVisible, oRule;
                bVisible = true;
                for (var i = 0, ii = oSchema.visibility.rules.length; i < ii; i++) {
                    oRule = oSchema.visibility.rules[i];
                    if (oRule.schema.indexOf('member.extattr') === 0) {
                        var memberSchemaId = oRule.schema.substr(15);
                        if (!oRecordData.member.extattr[memberSchemaId] || (oRecordData.member.extattr[memberSchemaId] !== oRule.op && !oRecordData.member.extattr[memberSchemaId][oRule.op])) {
                            bVisible = false;
                            break;
                        }
                    } else if (!oRecordData[oRule.schema] || (oRecordData[oRule.schema] !== oRule.op && !oRecordData[oRule.schema][oRule.op])) {
                        bVisible = false;
                        break;
                    }
                }
                domSchema.classList.toggle('hide', !bVisible);
                oSchema.visibility.visible = bVisible;
            }
        });
    }
    /* 显示题目的分数 */
    function fnShowSchemaScore(oScore) {
        _aScoreSchemas.forEach(function (oSchema) {
            var domSchema, domScore;
            domSchema = document.querySelector('[wrap=value][schema="' + oSchema.id + '"]');
            if (domSchema) {
                for (var i = 0; i < domSchema.children.length; i++) {
                    if (domSchema.children[i].classList.contains('schema-score')) {
                        domScore = domSchema.children[i];
                        break;
                    }
                }
                if (!domScore) {
                    domScore = document.createElement('div');
                    domScore.classList.add('schema-score');
                    domSchema.appendChild(domScore);
                }
                if (oScore) {
                    domScore.innerText = oScore[oSchema.id] || 0;
                } else {
                    domScore.innerText = '[空]';
                }
            }
        });
    }
    /* 显示题目的分数 */
    function fnShowSchemaBaseline(oBaseline) {
        if (oBaseline) {
            var domSchema, domBaseline;
            for (var schemaId in oBaseline.data) {
                domSchema = document.querySelector('[wrap=value][schema="' + schemaId + '"]');
                domBaseline = null;
                if (domSchema) {
                    for (var i = 0; i < domSchema.children.length; i++) {
                        if (domSchema.children[i].classList.contains('schema-baseline')) {
                            domBaseline = domSchema.children[i];
                            break;
                        }
                    }
                    if (!domBaseline) {
                        domBaseline = document.createElement('div');
                        domBaseline.classList.add('schema-baseline');
                        domSchema.appendChild(domBaseline);
                    }
                    domBaseline.innerText = oBaseline.data[schemaId];
                }
            }
        } else {
            /*清空目标值*/
            var domBaselines, domBaseline;
            domBaselines = document.querySelectorAll('[wrap=value] .schema-baseline');
            for (var i = 0; i < domBaselines.length; i++) {
                domBaseline = domBaselines[i];
                domBaseline.parentNode.removeChild(domBaseline);
            }
        }
    }
    /* 根据获得的记录设置页面状态 */
    function fnSetPageByRecord(rsp) {
        var oRecord, oOriginalData;
        $scope.Record.current = oRecord = rsp.data;
        oRecord.data = oOriginalData = rsp.data.data ? angular.copy(rsp.data.data) : {};
        if (oRecord.enroll_at === undefined) oRecord.enroll_at = 0;
        /* 设置轮次题目的可见性 */
        fnToggleRoundSchemas(_oApp.dynaDataSchemas, oOriginalData);
        /* 设置关联题目的可见性 */
        fnToggleAssocSchemas(_oApp.dynaDataSchemas, oOriginalData);
        /* 将数据转换为可直接显示的形式 */
        fnProcessData(rsp.data);
        /* 显示题目的分数 */
        if (_aScoreSchemas.length) {
            fnShowSchemaScore(rsp.data.score);
        }
        /* disable actions */
        if (_oApp.scenarioConfig.can_cowork && _oApp.scenarioConfig.can_cowork !== 'Y') {
            if ($scope.user.uid !== oRecord.userid) {
                fnDisableActions();
            }
        }
        $timeout(function () {
            var imgs;
            if (imgs = document.querySelectorAll('.data img')) {
                picviewer.init(imgs);
            }
        });
        /* 设置页面分享信息 */
        $scope.setSnsShare(oRecord);
        /* 同轮次的其他记录 */
        http2.post(LS.j('record/list', 'site', 'app') + '&sketch=Y', {
            record: {
                rid: oRecord.round.rid
            }
        }).then(function (rsp) {
            var records;
            if (records = rsp.data.records) {
                $scope.recordsOfRound = {
                    records: records,
                    page: {
                        size: 1,
                        total: rsp.data.total
                    },
                    shift: function () {
                        fnGetRecord(records[this.page.at - 1].enroll_key).then(fnSetPageByRecord);
                    }
                };
                for (var i = 0, l = records.length; i < l; i++) {
                    if (records[i].enroll_key === oRecord.enroll_key) {
                        $scope.recordsOfRound.page.at = i + 1;
                        break;
                    }
                }
            }
        });
        /* 目标轮次记录 */
        if (['C', 'S'].indexOf(oRecord.round.purpose) !== -1) {
            http2.get(LS.j('record/baseline', 'site', 'app') + '&rid=' + oRecord.round.rid).then(function (rsp) {
                if (rsp.data) {
                    /* 显示题目的目标值 */
                    fnShowSchemaBaseline(rsp.data);
                }
            });
        } else {
            /* 清除显示题目的目标值 */
            fnShowSchemaBaseline(false);
        }
    }

    var _oApp, _aScoreSchemas;

    $scope.gotoHome = function () {
        location.href = "/rest/site/fe/matter/enroll?site=" + _oApp.siteid + "&app=" + _oApp.id + "&page=repos";
    };
    $scope.addRecord = function (event, page) {
        if (page) {
            $scope.gotoPage(event, page, null, $scope.Record.current.round.rid, 'Y');
        } else {
            for (var i in $scope.app.pages) {
                var oPage = $scope.app.pages[i];
                if (oPage.type === 'I') {
                    $scope.gotoPage(event, oPage.name, null, $scope.Record.current.round.rid, 'Y');
                    break;
                }
            }
        }
    };
    $scope.editRecord = function (event, page) {
        if ($scope.app.scenarioConfig) {
            if ($scope.app.scenarioConfig.can_cowork !== 'Y') {
                if ($scope.user.uid !== $scope.Record.current.userid) {
                    noticebox.warn('不允许修改他人提交的数据');
                    return;
                }
            }
        }
        if (!page) {
            for (var i in $scope.app.pages) {
                var oPage = $scope.app.pages[i];
                if (oPage.type === 'I') {
                    page = oPage.name;
                    break;
                }
            }
        }
        $scope.gotoPage(event, page, $scope.Record.current.enroll_key);
    };
    $scope.removeRecord = function (event, page) {
        if ($scope.app.scenarioConfig.can_cowork && $scope.app.scenarioConfig.can_cowork !== 'Y') {
            if ($scope.user.uid !== $scope.Record.current.userid) {
                noticebox.warn('不允许删除他人提交的数据');
                return;
            }
        }
        noticebox.confirm('删除记录，确定？').then(function () {
            $scope.Record.remove($scope.Record.current).then(function (data) {
                page && $scope.gotoPage(event, page);
            });
        });
    };
    $scope.shiftRound = function (oRound) {
        fnGetRecordByRound(oRound).then(fnSetPageByRecord);
    };
    $scope.doAction = function (event, oAction) {
        switch (oAction.name) {
            case 'addRecord':
                $scope.addRecord(event, oAction.next);
                break;
            case 'editRecord':
                $scope.editRecord(event, oAction.next);
                break;
            case 'removeRecord':
                $scope.removeRecord(event, oAction.next);
                break;
            case 'gotoPage':
                $scope.gotoPage(event, oAction.next);
                break;
            case 'closeWindow':
                $scope.closeWindow();
        }
    };
    $scope.$on('xxt.app.enroll.ready', function (event, params) {
        var facRecord, facRound;

        /* 不再支持在页面中直接显示按钮 */
        fnHidePageActions();
        _oApp = params.app;
        _aScoreSchemas = [];
        _oApp.dynaDataSchemas.forEach(function (oSchema) {
            if (oSchema.requireScore === 'Y' && oSchema.format === 'number' && oSchema.type === 'shorttext') {
                _aScoreSchemas.push(oSchema);
            }
        });
        $scope.Record = facRecord = Record.ins(_oApp);
        facRound = new enlRound(_oApp);
        facRound.list().then(function (oResult) {
            $scope.rounds = oResult.rounds;
        });
        fnGetRecord().then(fnSetPageByRecord);
        /*设置页面导航*/
        $scope.setPopNav(['votes', 'repos', 'rank', 'kanban', 'event'], 'view');
        /*页面阅读日志*/
        $scope.logAccess();
    });
}]);