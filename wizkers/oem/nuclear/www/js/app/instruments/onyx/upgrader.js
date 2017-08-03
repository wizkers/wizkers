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
 *  An firmware upgrader interface for the Onyx.
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
        template = require('js/tpl/instruments/onyx/OnyxUpgrader.js');

    // Upgrader view
    return Backbone.View.extend({

        events: {
            "click #device_upgrade": "go",
            "click #file_sel": "select_file",
            "click #fw_dl": "download_fw"
        },

        firmware: "",

        prevent_failure: function () {
            console.log("User tried to exit the upgraded");
        },

        initialize: function () {
            linkManager.on('input', this.showInput, this);
            linkManager.on('status', this.updateStatus, this);
            if (!linkManager.isConnected()) {
                var id = instrumentManager.getInstrument().id;
                linkManager.openInstrument(id);
            } else {
                linkManager.driver.version();
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
            if (status.portopen) {
                linkManager.driver.version();
            }
        },

        render: function () {
            this.$el.html(template());
            return this;
        },

        download_fw: function () {
            var self = this;
            $('#fw_dl', this.el).html('Downloading...').addClass('btn-warning');
            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'https://www.dropbox.com/s/nl6yrof3f10lrkc/onyx-firmware.bin?dl=1', true);
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

        select_file: function () {
            var self = this;
            var chosenFileEntry = null;

            chrome.fileSystem.chooseEntry({
                type: 'openFile'
            }, function (readOnlyEntry) {

                readOnlyEntry.file(function (file) {
                    var reader = new FileReader();
                    reader.onerror = function (e) {
                        console.log(e);
                    };
                    reader.onloadend = function (e) {
                        self.firmware = e.target.result;
                        self.validate_fw();
                    };
                    // Our data is binary, so we need to put it into an
                    // arraybuffer, will make our life better:
                    reader.readAsArrayBuffer(file);
                });
            });
        },

        validate_fw: function () {
            try {
                //intelhex.parse(this.firmware).data;
                utils.showAlert('Success', 'Firmware seems valid, click on "Upgrade Firmware" to start the upgrade.',
                    'alert-success');
                $("#device_upgrade", this.el).attr('disabled', false).removeClass('btn-danger').addClass('btn-success');

            } catch (e) {
                utils.showAlert('Error', 'Invalid firmware file, are you sure you picked the right ".hex" firmware file?',
                    'alert-danger');
            }
        },


        go: function () {
            if (this.firmware.length == 0) {
                utils.showAlert('Error', 'No file selected', 'alert-danger');
                return;
            }
            stats.fullEvent('Firmare', 'fw_upgrade_start', 'onyx');
            $("#device_upgrade", this.el).attr('disabled', true);
            // Prevent a click on the Navbar which would crash the firmware upgrade!
            this.dumbUserHandler = function (e) {
                e.preventDefault();
            }
            $(".navbar-fixed-top a").click(this.dumbUserHandler)
            utils.hideAlert();
            utils.showAlert('Info', "Starting upgrade, please wait", 'alert-info');
            // Switch to our uploader driver
            instrumentManager.startUploader();
            // Wait until we get a confirmation of driver change and
            // open the instrument to put it in bootloader mode:
            linkManager.once('status', function () {
                linkManager.openBootloader(instrumentManager.getInstrument().id);
            });

        },

        showInput: function (data) {
            var self = this;

            // Update our raw data monitor
            if (data.writing == undefined) {
                var i = $('#input', this.el);
                var scroll = (i.val() + JSON.stringify(data) + '\n').split('\n');
                // Keep max 50 lines:
                if (scroll.length > 50) {
                    scroll = scroll.slice(scroll.length - 50);
                }
                i.val(scroll.join('\n'));
                // Autoscroll:
                i.scrollTop(i[0].scrollHeight - i.height());
            }

            if (data.openerror) {
                utils.showAlert('Error', 'Error: serial port not found - check the settings.', 'alert-danger');
            }


            // The first thing we do is ask for the current FW version - we
            // can't upgrade the firmware if the Onyx is not version 12.26-b at least
            if (data.version && data.status == undefined) {
                stats.fullEvent('Firmware', 'version_before', 'onyx ' + data.version);
                if (parseFloat(data.version) >= 12.26) {
                    $('#file_sel', this.el).attr('disabled', false);
                    $('#fw_dl', this.el).attr('disabled', false);
                    utils.showAlert('OK', 'Device is ready for firmware upgrade.', 'alert-success');

                } else {
                    utils.showAlert('Error', ' Warning: you can only upgrade firmware on Onyx devices already running firmware 12.26-b or higher.', 'alert-danger');
                }
                linkManager.closeInstrument();
                linkManager.off('status', this.updateStatus);
                return;
            }

            // The backend issues a chipID number as soon as
            // the bootloader is online, we take this as a cue to upload
            // the firmware to the device.
            if (data.chipID) {
                if (data.chipID != 420) {
                    $('#chipversion', this.el).removeClass('glyphicon-hourglass').addClass('glyphicon-remove');
                    $('#chipid', this.el).html(' --- Chip ID unsupported, please contact Medcom.');
                    $(".navbar-fixed-top a").unbind('click');
                } else {
                    stats.fullEvent('Firmware', 'fw_upload_start', 'onyx');
                    $('#chipversion', this.el).removeClass('glyphicon-hourglass').addClass('glyphicon-check');
                    $('#chipid', this.el).html('(chipID 420, STM32F1)');
                    linkManager.sendCommand({
                        'upload_bin': this.firmware
                     });
                }
            } else if (data.writing) {
                $("#prog-flash", this.el).width(data.writing + "%");
            } else if (data.verifying) {
                $("#prog-flash", this.el).width(data.verifying + "%");
            } else if (data.run_mode) {
                if (data.run_mode == 'firmware') {
                    utils.showAlert('Success', 'Firmware Upgrade was successful, device is restarting', 'alert-success');
                    $(".navbar-fixed-top a").unbind('click', this.dumbUserHandler);
                }
            } else if (data.version) {
                $('#bootloader', this.el).removeClass('glyphicon-hourglass').addClass('glyphicon-check');
                $('#blversion', this.el).html('( version ' + parseFloat(data.version) / 10 + ')');
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

                if (data.msg) {
                    if (data.msg == 'flash write protection disabled, device is resetting') {
                        $('#writeprotect', this.el).removeClass('glyphicon-hourglass').addClass('glyphicon-check');
                    }
                    if (data.msg == '...flash erased') {
                        $('#flasherased', this.el).removeClass('glyphicon-hourglass').addClass('glyphicon-check');
                    }
                    if (data.msg == 'firmware flashed') {
                        stats.fullEvent('Firmware', 'upgrade_success', 'onyx');
                        $(".navbar-fixed-top a").unbind('click', this.dumbUserHandler);
                        $('#flashprogrammed', this.el).removeClass('glyphicon-hourglass').addClass('glyphicon-check');
                    }
                }
            }
        }
    });

});