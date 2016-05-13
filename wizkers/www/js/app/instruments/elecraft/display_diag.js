/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
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

/**
 * Elecraft Diagnostics display. Work in progress
 * @author Edouard Lafargue ed@lafargue.name
 */
define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/instruments/elecraft/ElecraftDiagView.js');

    // Need to load these, but no related variables.
    require('bootstrap');
    require('bootstrapslider');

    var taking_screenshot = false;
    var pamode_on = false;

    var setLabel = function (selector, el, green) {
        if (green) {
            $(selector, el).addClass("label-success").removeClass("label-default");
        } else {
            $(selector, el).addClass("label-default").removeClass("label-success");
        }
    };

    return Backbone.View.extend({

        initialize: function () {
            // Don't stop the live stream anymore because we use it to monitor
            // the amplifier
            linkManager.stopLiveStream();
            linkManager.on('input', this.showInput, this);
            this.menumode = '';
            this.kxpa100 = false;
            this.px3 = false;

        },

        render: function () {
            var self = this;
            this.$el.html(template());
                                    
            require(['app/instruments/elecraft/display_kxpa100'], function(view) {
               self.KXPA100 = new view();
               $('#kxpa100', self.el).append(self.KXPA100.el);
               self.KXPA100.render(); 
            });

            require(['app/instruments/elecraft/settings_audio'], function(view) {
               self.SettingsAudio = new view();
               self.$('#settings-audio').append(self.SettingsAudio.el);
               self.SettingsAudio.render();
            });
            
            require(['app/instruments/elecraft/settings_band'], function(view) {
               self.BandSettings = new view();
               $('#settings-band', self.el).append(self.BandSettings.el);
               self.BandSettings.render();
            });

            require(['app/instruments/elecraft/settings_flash'], function(view) {
               self.FlashSettings = new view();
               $('#settings-flashx', self.el).append(self.FlashSettings.el);
               self.FlashSettings.render();
            });

            require(['app/instruments/elecraft/settings_mems'], function(view) {
               self.MemSettings = new view();
               $('#settings-mems', self.el).append(self.MemSettings.el);
               self.MemSettings.render();
            });
            self.queryKX3();

            // Force rendering of KX3 tab, somehow the drawing on the tab does not work
            // very well until I click, otherwise
            $("#settingsTabs a:first", this.el).tab('show');

            $("#cmp-control", this.el).slider();
            return this;
        },

        onClose: function () {
            console.log("Elecraft diagnostics view closing...");
            linkManager.off('input', this.showInput, this);
            if (this.KXPA100)
                this.KXPA100.onClose();
            if (this.SettingsAudio)
                this.SettingsAudio.onClose();
            if (this.BandSettings)
                this.BandSettings.onClose();
            if (this.FlashSettings)
                this.FlashSettings.onClose();
            if (this.MemSettings)
                this.MemSettings.onClose();
        },

        events: {
            'click #cmdsend': "sendcmd",
            'keypress input#manualcmd': "sendcmd",
            'click #px3-screenshot': "take_screenshot",
            'click #screenshot': "save_screenshot",
            'shown.bs.tab a[data-toggle="tab"]': "tab_shown",
        },

        tab_shown: function (e) {
            if (e.target.innerText == 'KXPA100') {
                this.KXPA100.shown(true);
            } else {
                this.KXPA100.shown(false);
            }

            if (e.target.innerText == 'KX3' &&
                this.$('#settings-audio').is(':visible')) {
                this.$('#kx3').css({'opacity': '0.3', 'pointer-events': 'none'});
                this.SettingsAudio.once('initialized', this.focusKX3, this);
                this.SettingsAudio.refresh();
            }
            
            if (e.target.innerText == 'Band config' &&
                this.BandSettings != undefined ) {
                this.BandSettings.refresh();
            }
            
            if (e.target.innerText == 'Memories') {
                this.MemSettings.refresh();
            }

        },
        
        focusKX3: function() {
            this.$('#kx3').css({'opacity': '1', 'pointer-events': ''});
        },

        take_screenshot: function () {
            // It looks like screenshots are not reliable when the KX3 and the KXPA100 are talking, so set
            // KXPA100 mode off during transfer
            taking_screenshot = true;
            $('#px3-screenshot').html('Wait...');
            linkManager.sendCommand('MN146;'); // PA Mode menu
            linkManager.sendCommand('MP;'); // Read the value
            // Now wait for the MP value to come back
        },

        save_screenshot: function () {
            var cnv = $('#screenshot')[0];
            window.open(cnv.toDataURL(), "screenshot.png");
        },

        queryKX3: function () {
            linkManager.sendCommand('MN072;MP004;MN255;'); // Enable Tech mode to reach every menu
            $("#kx3-sn", this.el).html(instrumentManager.getInstrument().get('uuid'));
            linkManager.sendCommand("RVM;RVD;OM;");
        },

        sendcmd: function (event) {
            // We react both to button press & Enter key press
            if ((event.target.id == "manualcmd" && event.keyCode == 13) || (event.target.id != "manualcmd"))
                linkManager.sendCommand(this.$('#manualcmd').val());
        },
        

        showInput: function (data) {

            if (typeof data == "string") {
                // Update our raw data monitor
                var i = $('#input', this.el);
                var scroll = (i.val() + data + '\n').split('\n');
                // Keep max 50 lines:
                if (scroll.length > 50) {
                    scroll = scroll.slice(scroll.length - 50);
                }
                i.val(scroll.join('\n'));
                // Autoscroll:
                i.scrollTop(i[0].scrollHeight - i.height());
            }

            if (data.screenshot != undefined) {
                // Restore PA Mode from state before screenshot:
                if (pamode_on) {
                    linkManager.sendCommand('MN146;MP001;MN255;');
                    setTimeout(function () {
                        linkManager.sendCommand('RVM;'); // Not really used, just flushes the buffer
                    }, 2000);
                }
                // Incoming data from a screenshot
                var height = data.height;
                var width = data.width;
                var cnv = $('#screenshot')[0];
                var ctx = cnv.getContext('2d');
                ctx.canvas.width = width;
                ctx.canvas.height = height;
                var imageData = ctx.createImageData(width, height);

                // Now fill the canvas using our B&W image:
                // Our data is a 272x480 array of 32bit integers that store RGB values
                // as r<<16 | g <<8 | b
                for (var y = 0; y < height; y++) {
                    for (var x = 0; x < width; x++) {
                        // Find pixel index in imageData:
                        var idx = (y * width + x) * 4;
                        imageData.data[idx] = data.screenshot[y][x] >> 16;
                        imageData.data[idx + 1] = 0xff & (data.screenshot[y][x] >> 8);
                        imageData.data[idx + 2] = 0xff & (data.screenshot[y][x]);
                        imageData.data[idx + 3] = 255; // Alpha
                    }
                }
                ctx.putImageData(imageData, 0, 0);
                $('#px3-screenshot').html('Take Screenshot');
            } else if (data.downloading != undefined) {
                $('#bmdownload', this.el).width(data.downloading + "%");
            } else {
                // Populate fields depending on what we get:
                var da2 = data.substr(0, 2);
                var da3 = data.substr(0, 3);
                if (da3 == 'RVM') {
                    $("#kx3-fw-mcu", this.el).html(data.substr(3));
                } else if (data == 'PX3' ) {
                    linkManager.sendCommand('#RVM;');
                } else if (data.substr(0,4) == '#RVM') {
                    this.$('#px3-fw').html('v' + data.substr(4));
                } else if (da3 == 'RVD') {
                    $("#kx3-fw-dsp", this.el).html(data.substr(3));
                } else if (da3 == '^RV') {
                    this.$('#kxpa-fwrv').html(data.substr(3));
                } else if (da3 == '^SN') {
                    this.$('#kxpa-sn').html(data.substr(3));
                } else if (da2 == 'OM') {
                    
                    linkManager.sendCommand('=;;'); // Try to detect PX3
                    // Display what options are installed/enabled
                    setLabel("#opt-kxat3", this.el, (data.charAt(3) == 'A'));
                    setLabel("#opt-kxpa100", this.el, (data.charAt(4) == 'P'));
                    setLabel("#opt-kxfl3", this.el, (data.charAt(5) == 'F'));
                    setLabel("#opt-kxat100", this.el, (data.charAt(9) == 'T'));
                    setLabel("#opt-kxbc3", this.el, (data.charAt(10) == 'B'));
                    setLabel("#opt-kx3-2m", this.el, (data.charAt(11) == 'X'));

                    if (data.charAt(4) == 'P') {
                        // Query the KXPA100 for its serial number
                        linkManager.sendCommand('^SN;^RV;');
                    }
                } else if (da2 == 'MP') {
                    pamode_on = (data.substr(2) === '000') ? false : true;
                    if (taking_screenshot) {
                        taking_screenshot = false;
                        // PA Mode off if it was on, take screenshot, but we need to wait for the amp to settle
                        if (pamode_on) {
                            linkManager.sendCommand('MP000;MN255;');
                            setTimeout(function () {
                                linkManager.sendCommand('#BMP;'); // PA Mode off, take Screenshot
                            }, 1500);
                        } else {
                            linkManager.sendCommand('MN255;'); // Get back to normal menu
                            linkManager.sendCommand('#BMP;'); // PA Mode off, take Screenshot
                        }
                    }
                }
            }
        }


    });

});