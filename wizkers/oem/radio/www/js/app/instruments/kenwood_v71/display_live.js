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

/**
 *  Kenwood V71A Live Display view
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        Snap = require('snap'),
        utils = require('app/utils'),
        template = require('js/tpl/instruments/kenwood_v71/LiveView.js');


    // Need to load these, but no related variables.
    require('bootstrap');
    require('bootstrapslider');
    require('jquery_mousewheel');

    // Match macro fields:
    var matchTempl = function (str, args) {
        return str.replace(/<(.*?)>/g, function (match, field) {
            return args[field] || match;
        });
    }

    return Backbone.View.extend({

        initialize: function () {
            this.deviceinitdone = false;

            this.textOutputBuffer = [];
            this.transmittingText = false;

            this.vfoangle = 0;
            this.locked = 0;
            this.powered = true;
            this.vfo = 'VFOx';

            this.tones = [];
            this.dcs_codes = [];

            // Keep the value of the previous VFO value to avoid
            // unnecessary redraws of the front panel.
            this.oldVFOA = null;
            this.oldVFOB = null;

            // Bad design: this has to be consistent with the settings in settings_wizkers.js
            // (sorry)
            if (this.model.get('radio_data_macros') == undefined) {
                this.model.set('radio_data_macros', {
                    cq: 'CQ CQ DE <MYCALL> <MYCALL>',
                    ans: '<YOURCALL> <YOURCALL> DE <MYCALL> pse kn',
                    qso: '<YOURCALL> DE <MYCALL> ',
                    kn: 'btu <YOURCALL> DE <MYCALL> kn',
                    sk: 'Thank you for this QSO, 73 and all the best! <YOURCALL> de <MYCALL> sk',
                    me: 'Operator: John, QTH: Palo Alto, CA. Grid: CM87wk',
                    brag: 'Rig: Elecraft KX3. Controller: Wizkers.io'
                });
            }

            linkManager.on('status', this.updateStatus, this);
            linkManager.on('input', this.showInput, this);
        },

        ElecraftFrequencyListView: null,
        bands: ["160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", 0, 0, 0, 0, 0, "2m"],

        render: function () {
            var self = this;
            this.$el.html(template());

            this.faceplate = Snap("#rigpic");
            Snap.load("js/app/instruments/kenwood_v71/TM-V71A.svg", function (f) {
                f.select("#layer1").click(function (e) {
                    self.handleButton(e);
                });
                self.faceplate.add(f);
                // Set display constraints for the radio panel:
                self.faceplate.attr({
                    width: "100%",
                });

                self.$("#rigpic .icon").hide();
                // Make the s-meter bars fairly transparent (the radio does not
                // support querying the S-Level
                self.$('#rigpic .vfoa-smeter-icon').css('opacity', '0.3');
                self.$('#rigpic .vfob-smeter-icon').css('opacity', '0.3');
            });

            // Load the frequencies sub view:
            require(['app/instruments/kenwood_v71/frequency_list'], function (view) {
                self.FrequencyListView = new view({
                    model: self.model
                });
                if (self.FrequencyListView != null) {
                    $('#frequencies-placeholder').html(self.FrequencyListView.el);
                    self.FrequencyListView.render();
                }
            });

            return this;
        },

        onClose: function () {
            linkManager.off('status', this.updatestatus, this);
            linkManager.off('input', this.showInput, this);

            // Note:  the 'onClose' method is called after we changed
            // the driver, so we don't have access to our Kenwood driver
            // anymore: TODO: refactor to first call a "closeDriver" method
            // before changing the instrument ? to be determined...

            // linkManager.driver.stopTextStream();

            if (this.FrequencyListView != null)
                this.FrequencyListView.onClose();

            console.log("Radio live view closing...");
        },

        events: {
            "keypress input.f-vfoa": "setvfo",
            "click #vfoa-tune": "setvfo",
            "keypress input.f-vfob": "setvfo",
            "click #vfob-tune": "setvfo",
            "mousewheel #vfoa-wheel": "vfoAWheel",
            "click #vfotoggle": "toggleVFO",
            "click .mode-btn": "selectMode",
            "change .vfoa-sql": "vfoSQLChange",
            "change .vfob-sql": "vfoSQLChange",
        },

        vfoSQLChange: function (e) {
            var v = $(e.target).val();
            var cl = $(e.target).hasClass('vfoa-sql') ? '.vfoa-tone' : '.vfob-tone';
            this.doVfoSQLChange(v,cl);
        },

        doVfoSQLChange: function(v, cl) {
            this.$(cl).empty();

            var mkval = function(options) {
                var html = '';
                for (var t in options) {
                    html += '<option value="' + options[t] + '">' + options[t] + '</option>';
                }
                return html;
            }

            switch (v) {
                case 'Tone':
                case 'CTCSS':
                    this.$(cl).append(mkval(this.tones));
                    break;
                case 'DCS':
                    this.$(cl).append(mkval(this.dcs_codes));
                    break;
            }

        },

        vfoAWheel: function(e) {
            // console.log('Mousewheel',e);
            this.vfoangle -= e.deltaY/2 % 360;
            var tx = this.dip_x * (Math.cos(this.vfoangle*Math.PI/360));
            var ty = this.dip_y * (1+Math.sin(this.vfoangle*Math.PI/360));
            this.vfodip.transform('t' + tx + ',' + ty);
            var step = Math.floor(Math.min(Math.abs(e.deltaY)/50, 7));
            var cmd = ((e.deltaY < 0) ? 'UP' : 'DN') + step + ';FA;';
            //linkManager.sendCommand(cmd);

        },

        toggleVFO: function () {
            linkManager.driver.toggleVFO();
        },

        addfrequency: function () {
            this.ElecraftFrequencyListView.addfrequency();
        },

        selectMode: function(e) {
            var mode = e.target.innerText;
            linkManager.driver.setMode(mode);
        },

        setvfo: function () {
            console.log(event.target);
            var id;
            if ((event.target.id == "vfoa-direct" && event.keyCode == 13) || (event.target.id != "vfoa-direct")) {
                id = '.vfoa-';
            } else if ((event.target.id == "vfob-direct" && event.keyCode == 13) || (event.target.id != "vfob-direct")) {
                id = '.vfob-';
            }
            var sqlmode = this.$(id + 'sql').val() || 'None';
            var tval = parseFloat(this.$(id + 'tone').val());
            var vfo = {
                band: (id == '.vfoa-') ? 'a':'b',
                freq: parseFloat(this.$(id + 'f').val()) * 1e6,
                mode: this.$(id + 'mode').val(),
                offset_freq: parseFloat(this.$(id + 'offset').val()) * 1e6,
                duplex: this.$(id + 'duplex').val(),
                tone_on: sqlmode == 'Tone',
                ct_on: sqlmode == 'CTCSS',
                dcs_on: sqlmode == 'DCS',
                tone_freq: tval,
                ct_freq: tval,
                dcs_code: tval
            };

            linkManager.sendCommand({ command: 'set_frequency', arg: vfo});
            linkManager.sendCommand({ command: 'get_frequency', arg: vfo});

        },

        handleButton: function (e) {
            console.log(e.target.id);
            switch (e.target.id) {
                case 'btn_lock':
                    this.locked = !this.locked;
                    linkManager.driver.lock(this.locked);
                    break;
                case 'btn_pwr':
                    this.powered = !this.powered;
                    linkManager.driver.power(this.powered);
            }
        },

        updateStatus: function (data) {
            if (data.portopen && !this.deviceinitdone) {
                // Load the list of tones from the backend driver,
                // for use by the direct VFO controls
                linkManager.sendCommand({command: 'get_tones'});
                linkManager.sendCommand({command: 'get_dcs_codes'});
                linkManager.startLiveStream();
                this.deviceinitdone = true;
            } else if (!data.portopen) {
                this.deviceinitdone = false;
            }
        },

        makeDropdown: function(val,cl, options) {
            var html = '<select style="width: 100%;" class="form-control menu-dropdown ' + cl + '">';
            for (var t in options) {
                html += '<option value="' + options[t] + '" ' + (val == options[t] ? 'selected' : '') + ' >' + options[t] + '</option>';
            }
            html += '</select>';
            return html;
        },
        makeDirectVFO: function() {
            this.$('#directvfo').empty();
            var row = '<tr><th>VFO</th><th>Freq</th><th>Mode</th><th>SQL Mode</th><th>Tone/Code</th><th>Duplex</th><th>Offset</th></tr>';
            // Called once we have both tones and dcs_codes
            row += '<tr><td><button id="vfoa-tune" class="btn btn-default">A</button></td>';
            row += '<td><input class="vfoa-f form-control"  size="9" maxlength="9" value="0"></td>';
            row += '<td>' + this.makeDropdown('FM', 'vfoa-mode', ['FM', 'NFM', 'AM']) + '</td>';
            row += '<td>' + this.makeDropdown( 'Tone', 'vfoa-sql', ['Tone', 'CTCSS', 'DCS', 'None']) + '</td>';
            row += '<td>' + this.makeDropdown( 0, 'vfoa-tone', this.tones) + '</td>';
            row += '<td>' + this.makeDropdown('-', 'vfoa-duplex', ['+', '-', 'Off']) + '</td>';
            row += '<td><input class="vfoa-offset form-control" size="9" maxlength="9"  value="' + 0 + '"></td>';
            row += '</tr>';
            this.$('#directvfo').append(row);

            row = '<tr><td><button id="vfob-tune" class="btn btn-default">B</button></td>';
            row += '<td><input class="vfob-f form-control"  size="9" maxlength="9" value="0"></td>';
            row += '<td>' + this.makeDropdown('FM', 'vfob-mode', ['FM', 'NFM', 'AM']) + '</td>';
            row += '<td>' + this.makeDropdown( 'Tone', 'vfob-sql', ['Tone', 'CTCSS', 'DCS', 'None']) + '</td>';
            row += '<td>' + this.makeDropdown( 0, 'vfob-tone', this.tones) + '</td>';
            row += '<td>' + this.makeDropdown('-', 'vfob-duplex', ['+', '-', 'Off']) + '</td>';
            row += '<td><input class="vfob-offset form-control" size="9" maxlength="9"  value="' + 0 + '"></td>';
            row += '</tr>';
            this.$('#directvfo').append(row);
        },

        showInput: function (data) {

            let vfoX = false;
            if (data.vfoa) {
                var f1 = ('' + (data.vfoa/1e6).toFixed(3)).substr(0,7); // Convert to a string
                if (data.vfoa < 1e9)
                    f1 = ' ' + f1;
                // Make sure we have 8 characters:
                f1 = (f1 + '000').substr(0,8);
                this.$(".vfoa-f").val(data.vfoa/1e6);
                this.$("#rigpic #vfoa").text(f1);
                // Toggle the right icons for freq (last three digits)
                this.$('#vfoa-5').hide();
                this.$('#vfoa-67').hide();
                this.$('#vfoa-75').hide();
                this.$('#vfoa-25').hide();
                this.$('#vfoa-33').hide();
                var lt = ('' + data.vfoa).slice(-3);
                switch (lt) {
                    case "250" :
                        this.$('#vfoa-25').show();
                        break;
                    case "500":
                        this.$('#vfoa-5').show();
                        break;
                    case "750":
                        this.$('#vfoa-75').show();
                        break;
                    case "333":
                        this.$('#vfoa-33').show();
                        break;
                    case "666":
                        this.$('#vfoa-67').show();
                        break;
                }
                vfoX = 'vfoa-';
            }
            if (data.vfob) {
                var f1 = ('' + (data.vfob/1e6).toFixed(3)).substr(0,7); // Convert to a string
                if (data.vfob < 1e9)
                    f1 = ' ' + f1;
                // Make sure we have 8 characters:
                f1 = (f1 + '000').substr(0,8);
                this.$(".vfob-f").val(data.vfob/1e6);
                this.$("#rigpic #vfob").text(f1);
                this.$('#vfob-5').hide();
                this.$('#vfob-75').hide();
                this.$('#vfob-25').hide();
                var lt = ('' + data.vfob).slice(-3);
                switch (lt) {
                    case "250" :
                        this.$('#vfob-25').show();
                        break;
                    case "500":
                        this.$('#vfob-5').show();
                        break;
                    case "750":
                        this.$('#vfob-75').show();
                        break;
                }
                vfoX = 'vfob-';
            }
            if (vfoX) {
                // Adjust the VFO icons:
                let o = data.vfo_options;
                switch (o.shift) {
                    case 0:
                        this.$('#' + vfoX + 'minus').hide();
                        this.$('#' + vfoX + 'plus').hide();
                        this.$('.' + vfoX + 'duplex').val('Off');
                        break;
                    case 1:
                        this.$('#' + vfoX + 'minus').hide();
                        this.$('#' + vfoX + 'plus').show();
                        this.$('.' + vfoX + 'duplex').val('+');
                        break;
                    case 2:
                        this.$('#' + vfoX + 'minus').show();
                        this.$('#' + vfoX + 'plus').hide();
                        this.$('.' + vfoX + 'duplex').val('-');
                        break;
                }

                this.$('#' + vfoX + 'T').toggle(o.tone);
                this.$('#' + vfoX + 'CT').toggle(o.ct);
                this.$('#' + vfoX + 'DCS').toggle(o.dcs);
                var sql_mode = (o.tone) ? 'Tone' : (o.ct) ? 'CTCSS' : (o.dcs) ? 'DCS' : 'None';
                this.$('.' + vfoX + 'sql').val(sql_mode);
                this.doVfoSQLChange(sql_mode, '.' + vfoX + 'tone');
                switch (sql_mode) {
                    case 'Tone':
                        this.$('.' + vfoX + 'tone').val(o.tone_freq);
                        break;
                    case 'CTCSS':
                        this.$('.' + vfoX + 'tone').val(o.ct_freq);
                        break;
                    case 'DCS':
                        this.$('.' + vfoX + 'tone').val(o.dcs_code);
                        break;
                }

                switch (o.mode) {
                    case 'FM':
                        this.$('#' + vfoX + 'N').hide();
                        if (vfoX == 'vfoa-')
                            this.$('#icon-AM').hide();
                        this.$('.' + vfoX + 'mode').val('FM');
                        break;
                    case 'NFM':
                        this.$('#' + vfoX + 'N').show();
                        if (vfoX == 'vfoa-')
                            this.$('#icon-AM').hide();
                        this.$('.' + vfoX + 'mode').val('NFM');
                        break;
                    case 'AM':
                        this.$('#' + vfoX + 'N').hide();
                        if (vfoX == 'vfoa-')
                            this.$('#icon-AM').show();
                        this.$('.' + vfoX + 'mode').val('AM');
                        break;
                }

                this.$('.' + vfoX + 'offset').val(o.offset_freq/1e6);
            }

            if (data.vfoa_sql != undefined) {
                if (data.vfoa_sql) {
                    this.$('#vfoa-busy').show();
                    this.$('#rigpic .vfoa-smeter-icon').show();
                } else {
                    this.$('#vfoa-busy').hide();
                    this.$('#rigpic .vfoa-smeter-icon').hide();
                }
            }

            if (data.vfob_sql != undefined) {
                if (data.vfob_sql) {
                    this.$('#vfob-busy').show();
                    this.$('#rigpic .vfob-smeter-icon').show();
                } else {
                    this.$('#vfob-busy').hide();
                    this.$('#rigpic .vfob-smeter-icon').hide();
                }
            }

            if (data.vfoa_power != undefined) {
                this.$('.vfoa-power-icon').hide();
                switch (data.vfoa_power) {
                    case 0:
                        this.$('#vfoa-power-H').show();
                        break;
                    case 1:
                        this.$('#vfoa-power-M').show();
                        break;
                    case 2:
                        this.$('#vfoa-power-L').show();
                        break;
                }
            }

            if (data.vfob_power != undefined) {
                this.$('.vfob-power-icon').hide();
                switch (data.vfob_power) {
                    case 0:
                        this.$('#vfob-power-H').show();
                        break;
                    case 1:
                        this.$('#vfob-power-M').show();
                        break;
                    case 2:
                        this.$('#vfob-power-L').show();
                        break;
                }
            }

            if (data.ctrl_band != undefined) {
                if (data.ctrl_band) {
                    this.$('#vfob-CTRL').show();
                    this.$('#vfoa-CTRL').hide();
                } else {
                    this.$('#vfob-CTRL').hide();
                    this.$('#vfoa-CTRL').show();
                }
            }

            if (data.ptt_band != undefined) {
                if (data.ptt_band) {
                    this.$('#vfob-PTT').show();
                    this.$('#vfoa-PTT').hide();
                } else {
                    this.$('#vfob-PTT').hide();
                    this.$('#vfoa-PTT').show();
                }
            }

            if (data.channel != undefined) {
                this.$('#band' + (data.vfo ? 'B' : 'A') + '-channel').html((data.channel == -1 ? '' : ('   ' + data.channel).slice(-3)));
            }

            if (data.menu_settings) {
                // We can adjust lots of icons on the display based on the
                // menu settings. These are queried when we start live streaming
                let m = data.menu_settings;

                // VFO data
                let vfo_show = (m.data_band == 0 || m.data_band == 3) ? 'vfoa' : 'vfob';
                let vfo_hide = (m.data_band == 1 || m.data_band == 2) ? 'vfoa' : 'vfob';
                this.$('#' + vfo_show + '-D').show();
                this.$('#' + vfo_hide + '-D').hide();

                // BL Color, totally unnecessary but so cool
                let bg_color = (m.bl_color) ? '#90ac02' : '#ffbf01';
                this.$('.lcd-color').css('fill', bg_color);

                // Data speed
                if (m.data_speed) {
                    this.$('#icon-96').show();
                } else {
                    this.$('#icon-96').hide();
                }
            }

            if (data.tones) {
                this.tones = data.tones;
            }
            if (data.dcs_codes) {
                this.dcs_codes = data.dcs_codes;
                this.makeDirectVFO();
            }

        },

    });
});