/**
 * Where we define the settings
 */

window.Settings = Backbone.Model.extend({

    localStorage: new Backbone.LocalStorage("org.aerodynes.onyxdisplay.Settings"), // Unique name within your app.

    initialize: function () {
    },

    defaults: {
        serialPort: null,
        timezone: "browser",
        cpmcolor: 0,
        cpmscale: "linear",
        itemsperpage: 10,
        currentInstrument: null,
    }
});
