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
 *  An firmware upgrader interface BlueGiga-based BLE devices that support the standard
 *  OTA protocol.
 *
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */
define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        abu = require('app/lib/abutils'),
        template = require('js/tpl/instruments/bluegiga/Upgrader.js');

    // Upgrader view
    return Backbone.View.extend({

        events: {
            "click #device_upgrade": "go",
            "click #fw_dl": "download_fw"
        },

        firmware: "",

        prevent_failure: function () {
            console.log("User tried to exit the upgrader");
        },

        initialize: function () {
            linkManager.on('input', this.showInput, this);
            linkManager.on('status', this.updateStatus, this);
            this.flash_ready = false;
            if (!linkManager.isConnected()) {
                var id = instrumentManager.getInstrument().id;
                linkManager.openInstrument(id);
            } else {
                console.log('Need a closed intrument... shall we close/open?');

            }
        },

        onClose: function () {
            console.log("Upgrader view closing...");
            linkManager.off('input', this.showInput);
            linkManager.off('status', this.updateStatus);
            linkManager.closeInstrument();
            instrumentManager.stopUploader();
        },

        updateStatus: function (status) {
        },

        render: function () {
            this.$el.html(template());
            if (vizapp.type == 'cordova') {
                keepscreenon.enable();
            }
            return this;
        },

        download_fw: function () {
            var self = this;
            $('#fw_dl', this.el).html('Downloading...').addClass('btn-warning');
            var xhr = new XMLHttpRequest();
            // Version 2.0.1
            xhr.open('GET', 'https://github.com/michaelkroll/BLEbee/blob/master/firmware/BLEbee-v2.0.1/BLEBee-Firmware-BLE113-2.0.1-BLE-SDK1.3.2-b122.ota', true);
            // Version 2.0.0
            //xhr.open('GET', 'https://www.dropbox.com/s/uh22hgfmxjp6n18/BLEBee-Firmware-BLE113-2.0.0-BLE-SDK1.3.2-b122.ota?dl=1', true);
            xhr.responseType = 'arraybuffer';

            xhr.onload = function (e) {
                if (this.status == 200) {
                    $('#fw_dl', this.el).html('Downloaded').addClass('btn-success').removeClass('btn-warning');
                    self.firmware = this.response;
                    self.validate_fw();
                }
            };

            xhr.send();
        },

        validate_fw: function () {
            if (this.firmware.byteLength % 16 == 0) {
                utils.showAlert('Success', 'Firmware looks valid, press "Upgrade Firmware" to start the upgrade.', 'alert-success');
                $("#device_upgrade", this.el).attr('disabled', false).removeClass('btn-danger').addClass('btn-success');
            } else {
                utils.showAlert('Error', 'Invalid firmware file, contact info@wizkers.io for support.',
                    'alert-danger');
            }
        },

        go: function () {
            if (this.firmware.byteLength == 0) {
                utils.showAlert('Error', 'No file selected', 'alert-danger');
                return;
            }
            stats.fullEvent('Firmware', 'fw_upgrade_start', 'BLEBee');
            $("#device_upgrade", this.el).attr('disabled', true);
            // Prevent a click on the Navbar which would crash the firmware upgrade!
            // this.dumbUserHandler = function (e) {
            //    e.preventDefault();
            // }
            $(".navbar-fixed-top a").click(this.dumbUserHandler)
            utils.hideAlert();
            utils.showAlert('Info', "Upgrading, please wait. This will take several minutes.", 'alert-info');
            // Switch to our uploader driver
            instrumentManager.startUploader();
            // Wait until we get a confirmation of driver change and
            // open the instrument to put it in bootloader mode:
            linkManager.once('status', function (status) {
                linkManager.openBootloader(instrumentManager.getInstrument().id);
            });

        },

        showInput: function (data) {
            var self = this;

            if (data.openerror) {
                utils.showAlert('Error', 'Error: could not connect to the BLE module - check your settings.', 'alert-danger');
            }

            // The first thing we do is ask for the current FW version - we
            // can't upgrade the firmware if the Onyx is not version 12.26-b at least
            if (data.blebee_version != undefined) {
                if (data.blebee_version == 'v2.0.0') {
                    $('#fw_dl', this.el).attr('disabled', false);
                    utils.showAlert('Result', 'Your BLEBee needs a firmware upgrade. Press "Get latest firmware" to proceed.', 'alert-warning');

                } else {
                    utils.showAlert('Good news', 'Your BLEBee is already in version 2.0.1, no need to upgrade.', 'alert-success');
                }
                linkManager.closeInstrument();
                linkManager.off('status', this.updateStatus);
                return;
            } else if (data.ota_ready) {
                linkManager.sendCommand({ upload_bin: this.firmware });
            }  else if (data.writing) {
                $("#prog-flash", this.el).width(data.writing + "%");
            }

            if (data.status) {
                var t = 'alert-info';
                switch (data.status) {
                case 'ok':
                    t = 'alert-success';
                    break;
                case 'error':
                    t = 'alert-danger';
                }
                utils.showAlert('Info', data.status + '<br>' + ((data.msg) ? data.msg : ''), t);
            }
        }
    });

});
