window.loading = {
    finish: function() {
        var eleLoading;
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
                "angular": "/static/js/angular.min",
                "ui-bootstrap": "/static/js/ui-bootstrap-tpls.min",
                "main": "/views/default/site/fe/user/coin/main",
            },
            shim: {
                "angular": {
                    exports: "angular"
                },
            },
            urlArgs: function(id, url) {
                if (/angular|ui-bootstrap/.test(id)) {
                    return '';
                }
                return "?bust=" + (timestamp * 1);
            }
        });
        require(['angular'], function() {
            require(['ui-bootstrap'], function() {
                require(['main'], function() {
                    angular.bootstrap(document, ['app']);
                });
            });
        });
    }
};
window.loading.load();
