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
 * KX3 audio settings screen
 *
 * @author Edouard Lafargue, ed@lafargue.name
 *
 */

define(function(require) {
    "use strict";

    var template = require('js/tpl/instruments/elecraft/SettingsBand.js');

    return Backbone.View.extend({

        initialize:function () {
            this.menulist = [];
            this.menumode = '';
            linkManager.on('input', this.showInput, this);
        },

        bands: ["160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", 0, 0, 0, 0, 0, "2m"],

        events: {
            "click .band-btn": "setBand",
            'change .menu-dropdown': 'simpleMenuChange',
            'click #rpt-ofs-cmd': "setRptOfs",
            'keypress input#rpt-ofs': "setRptOfs",
        },

        onClose: function() {
            linkManager.off('input', this.showInput);
        },

        render:function () {
            var self = this;
            this.$el.html(template());
            return this;
        },

        refresh: function() {
            this.$el.css({'opacity': '0.3', 'pointer-events': 'none'});
            linkManager.sendCommand('BN;');
        },

        setBand: function (e) {
            console.log('[settings_band] setBand');
            var band = e.target.innerText;
            this.$el.css({'opacity': '0.3', 'pointer-events': 'none'});
            linkManager.driver.setBand(band);
            linkManager.sendCommand('BN;');
        },

        setRptOfs: function(e) {
            // We react both to button press & Enter key press
            if ((event.target.id == "rpt-ofs" && event.keyCode == 13) || (event.target.id != "rpt-ofs")) {
                linkManager.driver.setRptOfs(parseInt(this.$('#rpt-ofs').val()));
                // Repoll the radio after the change, in case the user didn't use a
                // multiple of 20:
                this.menulist = [[ 'rpt-ofs', 'MN007;MP;']];
                this.getNextMenu();
            }
        },

        getMenus: function() {
            this.menulist = [
                [ 'am-mode', 'MN126;MP;' ],
                [ 'fm-mode', 'MN018;MP;'],
                [ 'preamp', 'MN136;MP;'],
                [ 'rx-iso', 'MN124;MP;'],
                [ 'vfo-nr', 'MN119;MP;'],
                [ 'bnd-map', 'MN076;MP;'],
                [ 'rpt-ofs', 'MN007;MP;'],
                [ 'rx-shft', 'MN142;MP;']
            ];
            this.getNextMenu();
        },

        getNextMenu: function() {
            var nxt = this.menulist.shift();
            if (nxt != undefined) {
                console.log('[band settings] Geting menu ' + nxt[0] + ' with command ' + nxt[1]);
                this.menumode = nxt[0];
                linkManager.sendCommand(nxt[1]);
            } else {
                this.menumode = '';
                this.$el.css({'opacity': '1', 'pointer-events': ''});
                console.log('[band settings] Got all menu entries we needed');
            }
        },

        parseMenu: function(data) {
            var val = parseInt(data.raw.substr(2));
            console.log('[band settings] Parsing menu ' + this.menumode + ' with value ' + val);
            switch (this.menumode) {
                case 'rpt-ofs':
                    this.$('#rpt-ofs').val(val*20);
                    break;
                default:
                    this.$('#' + this.menumode).val(val);
                    break;
            }
            linkManager.sendCommand('MN255;');
            this.getNextMenu();
        },

        simpleMenuChange: function() {
            // These are simple menus where we can just set the KX3 menu direct
            var menuNumbers = {
                 'am-mode': '126',
                 'fm-mode': '018',
                 'preamp': '136',
                 'rx-iso': '124',
                 'vfo-nr': '119',
                 'rx-shft': '142'
            };
            var v = ("000" + $(event.target).val()).slice(-3);
            var n = event.target.id;
            linkManager.sendCommand('MN' + menuNumbers[n] + ';MP' + v + ';MN255;');
        },

        showInput: function(data) {
            if (!this.$el.is(':visible')) {
                return;
            }
            var cmd = data.raw.substr(0, 2);
            var val = data.raw.substr(2);

            if (cmd == 'BN') {
                // We need to check for this, because in some modes (AI2; for instance)
                // the KX3 echoes BNXX when changing band, and in others (AI0) it doesn't
                // which means we can end up with two "BN" messages when changing band.
                if (this.menulist != '')
                    return;
                var bnd = this.bands[parseInt(val)];
                // Update the band selection radio buttons too:
                this.$(".band-btn").removeClass("active");
                this.$("#band-" + bnd).parent().addClass("active");
                this.getMenus(); // Refresh all the dropdowns.
            } else if (cmd == 'MP' && this.menumode != '') {
                // Happens when we are reading from a menu
                this.parseMenu(data);
            }
        }
    });
});