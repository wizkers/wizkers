/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
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
        template = require('js/tpl/instruments/OnyxUpgrader.js');

    // Upgrader view
    return Backbone.View.extend({

        events: {
            "click #device_upgrade": "go",
            "click #file_sel": "select_file",
            "click #fw_dl": "download_fw"
        },

        firmware: "",

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
            $(this.el).html(template());
            return this;
        },

        download_fw: function () {
            var self = this;
            $('#fw_dl', this.el).html('Downloading...').addClass('btn-warning');
            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'http://www.wizkers.io/download/780/', true);
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
                    'bg-success');
                $("#device_upgrade", this.el).attr('disabled', false).removeClass('btn-danger').addClass('btn-success');

            } catch (e) {
                utils.showAlert('Error', 'Invalid firmware file, are you sure you picked the right ".hex" firmware file?',
                    'bg-danger');
            }
        },


        go: function () {
            if (this.firmware.length == 0) {
                utils.showAlert('Error', 'No file selected', 'bg-danger');
                return;
            }
            stats.fullEvent('Firmare','fw_upgrade_start', 'onyx');
            $("#device_upgrade", this.el).attr('disabled', true);
            utils.hideAlert();
            utils.showAlert('Info', "Starting upgrade, please wait", 'bg-info');
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
                utils.showAlert('Error', 'Error: serial port not found - check the settings.', 'bg-danger');
            }


            // The first thing we do is ask for the current FW version - we
            // can't upgrade the firmware if the Onyx is not version 12.26-b at least
            if (data.version && data.status == undefined) {
                stats.fullEvent('Firmware', 'version_before', 'onyx ' + data.version);
                if (parseFloat(data.version) >= 12.26) {
                    $('#file_sel', this.el).attr('disabled', false);
                    $('#fw_dl', this.el).attr('disabled', false);
                    utils.showAlert('OK', 'Device is ready for firmware upgrade.', 'bg-success');

                } else {
                    utils.showAlert('Error', ' Warning: you can only upgrade firmware on Onyx devices already running firmware 12.26-b or higher.', 'bg-danger');
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
                    stats.fullEvent('Firmware', 'upgrade_success', 'onyx');
                    utils.showAlert('Success', 'Firmware Upgrade was successful, device is restarting', 'bg-success');
                }
            } else if (data.version) {
                $('#bootloader', this.el).removeClass('glyphicon-hourglass').addClass('glyphicon-check');
                $('#blversion', this.el).html('( version ' + parseFloat(data.version) / 10 + ')');
            }

            if (data.status) {
                var t = 'bg-info';
                switch (data.status) {
                case 'ok':
                    t = 'bg-success';
                    break;
                case 'error':
                    t = 'bg-danger';
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
                        $('#flashprogrammed', this.el).removeClass('glyphicon-hourglass').addClass('glyphicon-check');
                    }
                }
            }
        }
    });

});