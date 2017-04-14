window.loading = {
    finish: function() {
        eleLoading = document.querySelector('.loading');
        eleLoading.parentNode.removeChild(eleLoading);
    },
    load: function() {
        var timestamp, minutes;
        timestamp = new Date();
        minutes = timestamp.getMinutes();
        minutes = Math.floor(minutes / 5) * 5;
        timestamp.setMinutes(minutes);
        timestamp.setMilliseconds(0);
        timestamp.setSeconds(0);

        require.config({
            waitSeconds: 0,
            paths: {
                "domReady": '/static/js/domReady',
                "angular": "/static/js/angular.min",
                "angular-sanitize": "/static/js/angular-sanitize.min",
                "ui-bootstrap": "/static/js/ui-bootstrap-tpls.min",
                "tms-discuss": "/static/js/xxt.ui.discuss2",
                "tms-coinpay": "/static/js/xxt.ui.coinpay",
                "tms-favor": "/static/js/xxt.ui.favor",
                "tms-siteuser": "/static/js/xxt.ui.siteuser",
                "xxt-page": "/static/js/xxt.ui.page",
                "xxt-share": "/static/js/xxt.share",
                "enroll-directive": "/views/default/site/fe/matter/enroll/directive",
                "enroll-common": "/views/default/site/fe/matter/enroll/common",
            },
            shim: {
                "angular": {
                    exports: "angular"
                },
                "angular-sanitize": {
                    deps: ['angular'],
                    exports: "angular-sanitize"
                },
                "xxt-share": {
                    exports: "xxt-share"
                },
                "enroll-common": {
                    deps: ['angular-sanitize'],
                    exports: "enroll-common"
                },
            },
            urlArgs: function(id, url) {
                if (/^[xxt-|enroll-]/.test(id)) {
                    return "?bust=" + (timestamp * 1);
                }
                return '';
            }
        });
        require(['xxt-page'], function(assembler) {
            require(['ui-bootstrap'], function() {
                assembler.bootstrap('/views/default/site/fe/matter/enroll/remark.js?_=' + (timestamp * 1));
            });
        });
    }
};
if (/MicroMessenger/i.test(navigator.userAgent)) {
    var site = location.search.match(/[\?&]site=([^&]*)/)[1];
    requirejs(["http://res.wx.qq.com/open/js/jweixin-1.0.0.js"], function(wx) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', "/rest/site/fe/matter/enroll/wxjssdksignpackage?site=" + site + "&url=" + encodeURIComponent(location.href.split('#')[0]), true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                if (xhr.status >= 200 && xhr.status < 400) {
                    try {
                        eval("(" + xhr.responseText + ')');
                        if (signPackage) {
                            window.wx = wx;
                            signPackage.debug = false;
                            signPackage.jsApiList = ['hideOptionMenu', 'onMenuShareTimeline', 'onMenuShareAppMessage'];
                            wx.config(signPackage);
                        }
                        window.loading.load();
                    } catch (e) {
                        alert('local error:' + e.toString());
                    }
                } else {
                    alert('http error:' + xhr.statusText);
                }
            };
        }
        xhr.send();
    });
} else {
    window.loading.load();
}