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
            this.showstream = settings.get('showstream');
            
            this.menumode = '';

        },

        render: function () {
            var self = this;
            this.$el.html(template());

            // Hide the raw data stream if we don't want it
            if (!this.showstream) {
                $('.showstream', this.el).css('visibility', 'hidden');
            }
                        
            require(['app/instruments/elecraft/display_kxpa100'], function(view) {
               self.KXPA100 = new view();
               $('#kxpa100', self.el).append(self.KXPA100.el);
               self.KXPA100.render(); 
            });

            require(['app/instruments/elecraft/settings_audio'], function(view) {
               self.SettingsAudio = new view();
               self.$('#settings-audio').append(self.SettingsAudio.el);
               self.SettingsAudio.render(); 
               require(['app/instruments/elecraft/equalizer'], function (view) {
                    self.elecraftRXEQ = new view({
                        eq: 'rx'
                    });
                    if (self.elecraftRXEQ != null) {
                        $('#kx3-rxeq', self.el).html(self.elecraftRXEQ.el);
                        // So that we don't overlap queries, we use an event mechanism to
                        // cascade creations and renderings:
                        self.elecraftRXEQ.once('initialized', self.makeTXEQ, self);
                        self.elecraftRXEQ.render();
                    }
                });
            });

            // Force rendering of KX3 tab, somehow the drawing on the tab does not work
            // very well until I click, otherwise
            $("#settingsTabs a:first", this.el).tab('show');

            $("#cmp-control", this.el).slider();
            return this;
        },

        onClose: function () {
            console.log("Elecraft diagnostics view closing...");
            linkManager.off('input', this.showInput, this);
            this.elecraftTXEQ.onClose();
            this.elecraftRXEQ.onClose();
            this.KXPA100.onClose();
            this.SettingsAudio.onClose();
        },

        events: {
            'click #cmdsend': "sendcmd",
            'keypress input#manualcmd': "sendcmd",
            'click #px3-screenshot': "take_screenshot",
            'click #screenshot': "save_screenshot",
            'shown.bs.tab a[data-toggle="tab"]': "tab_shown",
            'slideStop #cmp-control': 'setCP',
            'change .menu-dropdown': 'simpleMenuChange',
            'click .agc-spd': 'setAGCSpeed'
        },

        tab_shown: function (e) {
            if (e.target.innerText == 'KXPA100') {
                this.KXPA100.shown(true);
            } else {
                this.KXPA100.shown(false);
            }
        },

        makeTXEQ: function () {
            var self = this;
            require(['app/instruments/elecraft/equalizer'], function (view) {
                self.elecraftTXEQ = new view({
                    'eq': 'tx'
                });
                if (self.elecraftTXEQ != null) {
                    $('#kx3-txeq', self.el).html(self.elecraftTXEQ.el);
                    self.elecraftTXEQ.once('initialized', self.queryKX3, self);
                    self.elecraftTXEQ.render();
                }
            });

        },

        setCP: function (e) {
            linkManager.driver.setCP(e.value);
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
            $("#kx3-sn", this.el).html(instrumentManager.getInstrument().get('uuid'));
            linkManager.sendCommand("RVM;RVD;OM;CP;");
            this.getMenus();
        },

        sendcmd: function (event) {
            // We react both to button press & Enter key press
            if ((event.target.id == "manualcmd" && event.keyCode == 13) || (event.target.id != "manualcmd"))
                linkManager.sendCommand($('#manualcmd', this.el).val());
        },
        
        getMenus: function() {
            // Get all AGC-related settings through the menu system
            this.menulist = [
                [ 'agc-md', 'MN128;MP;' ],
                [ 'agc-spd-ssb', 'MN129;MD2;MP;' ],
                [ 'agc-spd-cw', 'MN129;MD3;MP;'],
                [ 'agc-spd-fm', 'MN129;MD4;MP;'],
                [ 'agc-spd-am', 'MN129;MD5;MP;'],
                [ 'agc-spd-data', 'MN129;MD6;MP;'],
                [ 'agc-thr', 'MN074;SWT19;MP;'],
                [ 'agc-atk', 'MN074;SWT27;MP;'],
                [ 'agc-hld', 'MN074;SWT20;MP;'],
                [ 'agc-dcy', 'MN074;SWT28;MP;'],
                [ 'agc-slp', 'MN074;SWT21;MP;'],
                [ 'agc-pls', 'MN074;SWT29;MP;'],
                [ 'afx-md', 'MN105;MP;'],
                [ 'micbias', 'MN135;MP;'],
                [ 'micbtn' , 'MN082;MP;'],
                [ 'tx-essb', 'MN096;DS;']
            ];
            this.getNextMenu();            
        },
        
        getNextMenu: function() {
            var nxt = this.menulist.shift();
            if (nxt != undefined) {
                this.menumode = nxt[0];
                linkManager.sendCommand(nxt[1]);
            } else {
                this.menumode = '';
                console.log('Got all menu entries we needed');
            }
        },
        
        parseMenu: function(data) {
            var val = parseInt(data.substr(2));
            switch (this.menumode) {
                case 'agc-spd-ssb':
                    this.$('#agc-spd-ssb').html('SSB:' + (val & 0x2 ? 'Fast' : 'Slow'));
                    break;
                case 'agc-spd-cw':
                    this.$('#agc-spd-cw').html('CW:' + (val & 0x2 ? 'Fast' : 'Slow'));
                    break;
                case 'agc-spd-fm':
                    this.$('#agc-spd-fm').html('FM:' + (val & 0x2 ? 'Fast' : 'Slow'));
                    break;
                case 'agc-spd-am':
                    this.$('#agc-spd-am').html('AM:' + (val & 0x2 ? 'Fast' : 'Slow'));
                    break;
                case 'agc-spd-data':
                    this.$('#agc-spd-data').html('DATA:' + (val & 0x2 ? 'Fast' : 'Slow'));
                    break;
                case 'agc-md' :
                case 'agc-thr':
                case 'agc-atk':
                case 'agc-hld':
                case 'agc-dcy':
                case 'agc-slp':
                case 'afx-md' :
                case 'micbias': // Bit 4 is bias enable
                case 'micbtn' : // MIC BTN: bit 0 is ptt enable, bit 2 is up/dn enable
                    this.$('#' + this.menumode).val(val);
                    break;
                case 'tx-essb': // data is a DS screen
                    var txt = "";
                    val = data.substr(2);
                    for (var i = 0; i < 8; i++) {
                        if (val.charCodeAt(i) & 0x80) // Dot on the left side of the character
                            txt += ".";
                        var val2 = val.charCodeAt(i) & 0x7F;
                        // Do replacements:
                        if (val2 == 0x40)
                            val2 = 0x20;
                        txt += String.fromCharCode(val2);
                    }
                    console.log(txt,txt.substr(2,3), txt.substr,6 );
                    this.$('#tx-essb').val((txt.substr(2,3) == 'OFF') ? 0: 1);
                    this.$('#tx-essb-val').val(parseFloat(txt.substr(6)));
                    break;

                    
            }
            linkManager.sendCommand('MN255;');
            this.getNextMenu();
        },
        
        simpleMenuChange: function() {
            // These are simple menus where we can just set the KX3 menu direct
            var menuNumbers = {
                 'agc-md': '128',
                 'afx-md': '105',
                 'micbias': '135',
                 'micbtn': '082',
                 'tx-essb': '096'
            };
            var v = ("000" + $(event.target).val()).slice(-3);
            var n = event.target.id;
            if (n == 'micbias' || n == 'micbtn') {
                // The KX3 refuses to modify MIC Bias in DATA mode
                linkManager.sendCommand('MD2;');
            }
            linkManager.sendCommand('MN' + menuNumbers[event.target.id] + ';MP' + v + ';MN255;');
        },
        
        setAGCSpeed: function() {
            // Toggles between slow and fast AGC speed
            console.log(event.target.id);
            var agc = $(event.target).html().split(':')[0];
            var toggles = {
                'SSB': ['agc-spd-ssb', 'MN129;MD2;'],
                'CW': ['agc-spd-cw', 'MN129;MD3;'],
                'FM': ['agc-spd-fm', 'MN129;MD4;'],
                'AM': ['agc-spd-am', 'MN129;MD5;'],
                'DATA': ['agc-spd-data', 'MN129;MD6;'],
            }
            // Enable refresh of the value by setting menumode
            this.menumode = toggles[agc][0];
            linkManager.sendCommand(toggles[agc][1] + 'UP;MP;');
        },
        

        showInput: function (data) {

            if (this.showstream) {
                // Update our raw data monitor
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
            } else if (data.substr(0,2) == 'MP' || data.substr(0,2) == 'DS' && this.menumode != '') {
                // Happens when we are reading from a menu
                this.parseMenu(data);
            } else {
                // Populate fields depending on what we get:
                var da2 = data.substr(0, 2);
                var da3 = data.substr(0, 3);
                if (da3 == 'RVM') {
                    $("#kx3-fw-mcu", this.el).html(data.substr(3));
                } else if (da2 == 'CP') {
                    // Speech compression
                    $('#cmp-control', this.el).slider('setValue', parseInt(data.substr(2)));
                } else if (da3 == 'RVD') {
                    $("#kx3-fw-dsp", this.el).html(data.substr(3));
                } else if (da2 == 'OM') {
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