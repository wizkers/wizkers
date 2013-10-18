/**
 * "instruments" 
 *
 */

window.Instrument = Backbone.Model.extend({

    urlRoot: "/instruments",
    idAttribute: "_id",
    
    type: null,

    initialize: function () {
        this.validators = {};
        this.validators.name = function (value) {
            return value.length > 0 ? {isValid: true} : {isValid: false, message: "You must enter a name"};
        };

        // Create a reference to my logs:
        this.logs = new Logs();
        this.logs.url = "/instruments/" + this.id + "/logs";
        
    },
    
    validateItem: function (key) {
        return (this.validators[key]) ? this.validators[key](this.get(key)) : {isValid: true};
    },

    // TODO: Implement Backbone's standard validate() method instead.
    validateAll: function () {

        var messages = {};

        for (var key in this.validators) {
            if(this.validators.hasOwnProperty(key)) {
                var check = this.validators[key](this.get(key));
                if (check.isValid === false) {
                    messages[key] = check.message;
                }
            }
        }

        return _.size(messages) > 0 ? {isValid: false, messages: messages} : {isValid: true};
    },    

    defaults: {
        name: "Friendly name",             // Used for display
        type: "onyx",                      // Corresponds to parsers known on the server side as well
        tag: "",                           // Asset tag for the instrument (if supported)
        uuid: "",                          // Serial number or unique ID (if supported)
        port: "/dev/tty.usb1234",          // Name of the port on server side
        comment: "enter your notes here",  // Simple comments
        icon: "",                          // TbD: either user-selectable, or served by server-side (linked to type)
        liveviewspan: 600,                 // Width of live view in seconds
        liveviewperiod: 1,                 // Period of polling if supported
        liveviewlogscale: false,                // Should live view display as a log scale by default ?
    }
});

window.InstrumentCollection = Backbone.Collection.extend({

    model: Instrument,
    url: "/instruments"

});
