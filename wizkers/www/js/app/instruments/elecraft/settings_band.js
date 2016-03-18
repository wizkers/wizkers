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

/**
 * KX3 audio settings screen
 *
 * @author Edouard Lafargue, ed@lafargue.name
 *
 */

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/instruments/elecraft/SettingsBand.js');

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
            linkManager.sendCommand('BN;');
        },
        
        setBand: function (e) {
            var band = e.target.innerText;
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
                console.log('[band settings] Got all menu entries we needed');
            }
        },
        
        parseMenu: function(data) {
            var val = parseInt(data.substr(2));
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
            var cmd = data.substr(0, 2);
            var val = data.substr(2);
            
            if (cmd == 'BN') {
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