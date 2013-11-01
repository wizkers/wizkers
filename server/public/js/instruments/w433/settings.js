/**
 *  Settings returns an intrument settings view
 *  These are settings at the application level, not
 *  settings of the device.
 */

window.W433SettingsView = Backbone.View.extend({
    
    initialize:function () {
        this.render();
    },

    render:function () {
        $(this.el).html(this.template());
        return this;
    }


});