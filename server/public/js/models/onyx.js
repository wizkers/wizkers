/**
 * Where we define the settings
 */

window.Onyx = Backbone.Model.extend({

    initialize: function () {
    },

    defaults: {
        guid: 0,          // Device UUID
        devicetag: "",    //
        nickname: "Onyx", // Human-readable device name
    }
});

window.OnyxCollection = Backbone.Collection.extend({
   
    model: Onyx,
    localStorage: new Backbone.LocalStorage("org.aerodynes.onyxdisplay.Onyx"), // Unique name within your app.
    
    
});