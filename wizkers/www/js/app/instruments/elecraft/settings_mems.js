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
 * KX3 Flash explorer - use at your own risk
 *
 * @author Edouard Lafargue, ed@lafargue.name
 *
 */

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        abu = require('app/lib/abutils'),
        template = require('js/tpl/instruments/elecraft/SettingsMems.js');

    return Backbone.View.extend({

        initialize:function () {
            this.menulist = [];
            this.menumode = '';
            linkManager.on('input', this.showInput, this);
        },
        
        events: {
            "click #memread": "readMemory"
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
        },
        
        readMemory: function() {
          var i = $('#flashdump', this.el);
          console.log("Read flash location");
          var address = ("0000" + (0x0C00 + 0x40 * parseInt(this.$("#memtoread").val())).toString(16)).slice(-4);
          var l = "40";
          if ( parseInt(address,16) > 0xFFFF) {
              i.val("Error: address must be between 0000 and FFFF");
              return;
          }
          // Calculate the checksum:
          var st = abu.hextoab(address + l);
          var sum = 0xff;
          st.forEach(function(b){sum += b;});
          var crc = ("00" + (0xff - (sum % 0x100)).toString(16).toUpperCase()).slice(-2);
          // Now send the mem read command
          linkManager.sendCommand("ER" + address + l + crc + ";");
        },
        
        /**
         * Creates a HTML snippet with the mode selected
         */
        makeModeDropdown: function(mode, id, datarev, cwrev) {
            var basemodes = [ 'CW', 'LSB', 'USB', 'DATA', 'AM', 'FM'];
            var modes = ['CW', 'CW-REV', 'LSB', 'USB', 'DATA', 'DATA-REV', 'AM', 'FM'];
            var html = '<select style="width: 100%;" class="menu-dropdown" id="modea-' + id + '">';
            // Depending on datarev and cwrev, we must update the actual mode name:
            var text = basemodes[mode];
            if (text == 'CW') {
                if (cwrev == 1) text = 'CW-REV';
            } else if (text == 'DATA') {
                if (datarev == 0) text = 'DATA-REV';
            }
            for (var m in modes) {
                html += '<option value="' + modes[m] + '" ' + (text == modes[m] ? 'selected' : '') + ' >' + modes[m] + '</option>';
            }
            html += '</select>';
            return html;   
        },
        
        makeDataModeDropdown: function (mode, id) {
            var modes = ['DATA A', 'AFSK A', 'FSK D', 'PSK D', 'Unset'];
            var html = '<select style="width: 100%;" class="menu-dropdown" id="datamode-' + id + '">';
            for (var m in modes) {
                html += '<option value="' + modes[m] + '" ' + (mode == m ? 'selected' : '') + ' >' + modes[m] + '</option>';
            }
            html += '</select>';
            return html;   
            
        },
        
        makePLToneDropdown: function(tone, id) {
            var tones = ['', '67.0', '69.3', '71.9','74.4', '77.0', '79.7', '82.5', '85.4', '88.5', '91.5', '94.8', '97.4', '100.0',
                          '103.5', '107.2', '110.9', '114.8', '118.8', '123.0', '127.3', '131.8', '136.5', '141.3', '146.2',
                          '151.4', '156.7', '159.8', '162.2', '165.5', '167.9', '171.3', '173.8', '177.3', '179.9', '183.5',
                          '186.2', '189.9', '192.8', '196.6', '199.5', '203.5', '206.5', '210.7', '218.1', '225.7', '229.1',
                          '233.6', '241.8', '250.3', '254.1', '1750.0'];
            var html = '<select style="width: 100%;" class="menu-dropdown" id="pltone-' + id + '">';
            for (var t in tones) {
                html += '<option value="' + tones[t] + '" ' + (tone == t ? 'selected' : '') + ' >' + tones[t] + '</option>';
            }
            html += '</select>';
            return html;   
        },
        
        makeSplit: function(spl, id) {
          return '<input type="checkbox" ' + (spl ? 'checked' : '') + ' id="split-' + id + '">';  
        },
        
        makeOffsetDropdown: function (offset, id) {
          var offsets = [ -5, -1.7, -1.6, -1.0, -0.6, -0.5, -0.1, 0, 0.5, 0.6, 5.0];
          var html = '<select style="width: 100%;" class="menu-dropdown" if="offset-' + id + '">';
          for (var o in offsets) {
              html += '<option value="' + offsets[o] + '" ' + (offset == offsets[o] ? 'selected' : '') + ' >' + offsets[o] + '</option>';
          }
          html += '</select>';
          return html;
        },
        
        decodeVFO: function(buf) {
            // Frequencies are stored in BCD-like format
            var f = buf[0] * 1e6;
            f += buf[1] * 1e4;
            f += buf[2] * 1e2;
            f += buf[3] * 1e1;
            f += buf[4];
            return f/1e6; 
        },
        
        decodeMemory: function(buf, id) {
          // Detect an unused memory and bail early
          if (buf[0] == 0xff) {
            var row = '<tr><td>' + id + '</td>';
            row += '<td>Empty</td>';
            row += '<td>Empty memory</td>';
            row += '<td></td>';
            row += '<td></td>';
            row += '<td></td>';
            row += '<td></td>';
            row += '<td></td>';
            row += '<td></td>';
            row += '<td></td>';
            row += '<td></td></tr>';
            this.$('#freqtable').append(row);
            return;
          }
            
          var vfoa = this.decodeVFO(buf.slice(0,5));
          var vfob = this.decodeVFO(buf.slice(5,10));
          
          // In this code, we assume we have Xverter 1 set to 2m XV1 IF= 50MHz RF = 144MHz
          // The proper Elecraft code check the transverter actual IF and RF. This will break
          // on the 4m transverters, but I don't have one, so...
          if (buf[15] == 0x10) {
              vfoa += (144-50);
              vfob += (144-50);
          }
          
          var modea = buf[10] & 0xf;
          var modeb = buf[10] >> 4;
          var datamode = (buf[11] >> 5) & 0x3;
          var datamoderev = (buf[11] >> 2) & 0x01; // Is DATA mode reversed ?
          var cwmoderev = (buf[12] >> 6) & 0x01;   // Is CW mode reversed ?
          
          var offset = buf[17]/50;
          var offdir = buf[18] & 0x3;
          if (offdir == 2) offset = -offset;
          
          var tone = buf[16];
          
          var chars = [ ' ', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q',
                        'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7',
                        '8', '9', '*', '+', '/', '@', '_', ];
          var label = '';
          var idx = 32;
          while (idx < 37) {
              label += chars[buf[idx++]];
          }
          
          // Extract the description string:
          var description = '';
          idx = 37;
          while (buf[idx] != 0 && buf[idx] != 0xff) {
              description += String.fromCharCode(buf[idx++]);
          }
          
          // Create a table row:
          var row = '<tr id="' + id + '"><td>' + id + '</td>';
          row += '<td>' + label + '</td>';
          row += '<td>' + description + '</td>';
          row += '<td>' + vfoa + '</td>';
          row += '<td>' + this.makeModeDropdown(modea, id, datamoderev, cwmoderev) + '</td>';
          row += '<td>' + this.makeDataModeDropdown(datamode, id) + '</td>';
          row += '<td>' + vfob + '</td>';
          row += '<td>' + this.makeSplit(buf[13] & 0x01, id) + '</td>';
          row += '<td>' + this.makeModeDropdown(modeb, id, datamoderev, cwmoderev) + '</td>';
          row += '<td>' + this.makeOffsetDropdown(offset, id) + '</td>';
          row += '<td>' + this.makePLToneDropdown(tone,id) + '</td></tr>';

          this.$('#freqtable').append(row);
          
        },
        
        showInput: function(data) {
            if (!this.$el.is(':visible')) {
                return;
            }
            var cmd = data.substr(0, 2);
            var val = data.substr(2);
            if (cmd == "ER") {
                var buf = val.substr(6, val.length -8);
                var b = abu.hextoab(buf);
                var address = parseInt(val.substr(0,4), 16);                
                // If we detect we have a frequency memory address, then decode what we can:
                if ((address >= 0x0c00) && (address <= 0x3Dc0) && ( address % 0x40 == 0)) {
                    this.decodeMemory(b, (address-0x0C00)/0x40);
                }
                
            }
        }
    });
});