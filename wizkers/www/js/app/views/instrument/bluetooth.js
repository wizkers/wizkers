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

/*
 * Selector for Bluetooth low energy communications.
 * @author Edouard Lafargue, ed@lafargue.name
 */
define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        template = require('tpl/connections/bluetooth');

    return Backbone.View.extend({

        initialize: function (options) {
            this.ports = [];
            this.refresh();
            linkManager.on('status', this.updatestatus, this);
        },

        events: {
            "click #refresh": "refresh"
        },

        onClose: function () {
            console.log("Bluetooth connexion settings closing");
            var self = this;
            if (vizapp.type == 'cordova') {
                bluetoothle.stopScan(function () {
                            console.log('Stopped scan');
                            self.trigger('status', {scanning: false});
                        }, function () {});
            }
            linkManager.off('status', this.updatestatus, this);
        },

        updatestatus: function(status) {
            if (status.scanning != undefined) {
                if (status.scanning) {
                    this.$('#refresh').html('<img src="img/loading.gif">');
                } else {
                    this.$('#refresh').html('<span class="glyphicon glyphicon-refresh"></span>');
                    linkManager.off('ports', this.refreshDevices, this);
                }
            }
        },

        render: function () {
            this.$el.html(template(_.extend(this.model.toJSON(), {
                ports: this.ports
            })));
            return this;
        },

        refreshDevices: function (devices) {
            // Now, reorder the list of devices by RSSI
            // when we are in Cordova mode (the RSSI is not returned
            // in Chrome mode)
            if (vizapp.type == 'cordova' || vizapp.type == 'server') {
                this.ports = [ { address:'00:00:00:00:00:00', name: 'Select here...'}];
                for (var i in devices) {
                    this.ports.push(devices[i]);
                }
                this.ports.sort(function(a,b) {
                    if (a.rssi > b.rssi)
                        return 1;
                    if (a.rssi < b.rssi)
                        return -1;
                    return 0;
                });
            } else
                this.ports = devices;
            this.render();
        },

        refresh: function () {
            var self = this;
            // Catch a "Refresh" value here which indicates we should
            // just ask for a list of ports again:
            var insType = this.model.get('type');
            linkManager.on('ports', this.refreshDevices, this);
            linkManager.getPorts(insType);
            // Remove the callback after one minute as a safeguard
            setTimeout(function () {
                linkManager.off('ports', self.refreshDevices, self);
            }, 60000);
        }

    });
});