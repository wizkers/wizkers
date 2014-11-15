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
    
    require('bootstrap');

    return Backbone.View.extend({

        initialize:function () {
        },

        render:function () {        
            $(this.el).html(template(this.model.toJSON()));
            
            // Depending on the runmode, we can display additional info
            if (vizapp.type == "chrome") {
                $("#chromesettings", this.el).append("<br><h4>Storage</h4>");
                chrome.storage.local.getBytesInUse(function(used){
                    $("#chromesettings", this.el).append("<p>" + used + " bytes used out of a " +
                                                         chrome.storage.local.QUOTA_BYTES + " bytes quota.</p>");
                    });
            }
            
            return this;
        },

        events: {
            "change"      : "change",
            "click #reset": "reset_settings",
            "click #reset_storage" : "reset_storage_ask",
            "click #do-delete" : "do_reset_storage",
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

        reset_settings: function() {
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
        
        reset_storage_ask: function() {
            $('#deleteConfirm',this.el).modal('show');
        },
        
        do_reset_storage: function() {
            
            var dbreq = indexedDB.open("wizkers-logs",1);
            dbreq.onsuccess = function (event) {
                var db = event.result;
                console.log(event);
                console.log(dbreq);
            };
            dbreq.onerror = function (event) {
                        console.error("indexedDB.delete Error: " + event.message);
            };
            
            
            
            
            var ins = instrumentManager.getInstrument();
            if (ins != null) {
                linkManager.closeInstrument(ins.id);
            }
            chrome.storage.local.clear();
            instrumentManager.clear();
            $('#deleteConfirm',self.el).modal('hide');
            router.navigate('home', {trigger: true});
        },



    });
});