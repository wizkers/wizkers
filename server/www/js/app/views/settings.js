/**
 * The global settings for the applications.
 *
 * 2014.03: Needs refactoring / updates
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */
define(function(require) {
    
    "use strict";
    
    var $        = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/SettingsView.js');

    return Backbone.View.extend({

        initialize:function () {
        },

        render:function () {        
            $(this.el).html(template(this.model.toJSON()));
            return this;
        },

        events: {
            "change"      : "change",
            "click #reset": "resetSettings",
            "click .cpmcolor": "selectColor",
        },

        change: function(event) {
            console.log("Settings changed");
            // Apply the change to the model
            var target = event.target;
            var change = {};
            change[target.name] = (target.type == "checkbox") ? target.checked : target.value;
            this.model.set(change);
            this.model.save();
            this.render();

        },

        selectColor: function(event) {
            var self = this;
            console.log("Selected color: " + event.target.title);
            this.model.set('cpmcolor', event.target.title);
            this.model.save({success: function() { self.render; } });
        },

        resetSettings: function() {
            var self = this;
            // Clear our global settings/state:
            this.model.clear().set(this.model.defaults);
            this.model.save(null, {
                    success: function(model) {
                       utils.showAlert('Success', 'Settings cleared', 'alert-success');
                        self.render();
                       return true;
                    },
                    error: function () {
                        utils.showAlert('Error', 'An error occurred while trying to clear the settings', 'alert-error');
                }
            });
            return false;
        },



    });
});