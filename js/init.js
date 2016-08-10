module.exports = function (app) {
    var ShareUrlInfo = require('./share.js');

    function init (config, projection,  settings, gisServerType, useProxyScript) {
        var shareUrlInfo = ShareUrlInfo.parseUrl(window.location.toString());
        app.projection = projection;
        seldon.projection = projection;
        seldon.gisServerType = gisServerType;
        seldon.useProxyScript = useProxyScript;
        app.launch(config, shareUrlInfo, settings);
        seldon.app = app;
    }

    return init;
}
