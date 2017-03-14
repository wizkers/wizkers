/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
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
                    if (this.$('#port option').length > 2) {
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