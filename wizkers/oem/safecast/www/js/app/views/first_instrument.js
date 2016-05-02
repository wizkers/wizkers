/**
 * (c) 2016 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */
define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/FirstInstrument.js');

    return Backbone.View.extend({

        initialize:function () {
            linkManager.on('status', this.updatestatus, this);
        },

        events: {
            'click #create-instrument': 'createInstrument'
        },

        onClose: function() {
            console.log("[Safecast] First instrument view closing");
            linkManager.on('status', this.updatestatus, this);
        },
        
        setApiKey: function(k) {
            this.apiKey = k;
        },
        
        createInstrument: function() {
            // OK, that's it: we now have all the info we need to create
            // a new bGeigie
            
            this.instrument.set('metadata', {'apikey': this.apiKey});
            this.instrument.set('type', 'bgeigie');
            this.instrument.set('name', 'My bGeigie');
            this.instrument.set('port', this.$('#port').val());
            this.instrument.save(null, {
                success: function (model) {
                        settings.set({
                            currentInstrument: model.id
                        });
                        settings.save(); // will trigger an instrument change from the router
                        router.switchinstrument(model.id);
                },
                error: function () {
                    console.log('Instrument: error saving');
                    utils.showAlert('Error:', 'An error occurred while trying to save intrument config', 'alert-danger');
                }
            });
        },
        
        updatestatus: function(status) {
            console.log('Status', status);
            if (status.scanning != undefined) {
                if (status.scanning)
                    this.$('#create-instrument').prop('disabled', true);
                else {
                    // If we have several devices detected, then we need
                    // to warn the user !
                    if (this.$('#port option').length > 1) {
                        this.$('#scan-comment').html('<b>Warning:</b> several bGeigies detected, the closest one has been selected for you.');
                    }
                    this.$('#create-instrument').prop('disabled', false).html('Finish setup');
                }
            }
        },

        render:function () {
            var self = this;
            this.$el.html(template());
            
            require(['app/models/instrument'], function (model) {
                self.instrument = new model.Instrument();
                instrumentManager.getConnectionSettingsFor("bgeigie", {
                    model: self.instrument
                }, function (view) {
                    self.$('#portsettings').html(view.el);
                    view.render();
                    // Keep a reference to tell the view to close
                    // when we close this view
                    self.connectionView = view;
                });
            });
            return this;
        },
    });
});