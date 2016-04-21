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
        template = require('js/tpl/instruments/elecraft/SettingsFlash.js');

    return Backbone.View.extend({

        initialize:function () {
            this.menulist = [];
            this.menumode = '';
            linkManager.on('input', this.showInput, this);
        },
        
        events: {
            "click #flashread": "flashRead"
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
        
        flashRead: function() {
          var i = $('#flashdump', this.el);
          console.log("Read flash location");
          var address = this.$("#memloc").val().toUpperCase();
          var l = ("00" + this.$("#bytestoread").val().toUpperCase()).slice(-2);
          if ( parseInt(l,16) > 0x40) {
              i.val("Error: bytes to read must be between 00 and 40");
              return;
          }
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
        
        decodeVFO: function(buf) {
            // Frequencies are stored in BCD-like format
            var f = buf[0] * 1e6;
            f += buf[1] * 1e4;
            f += buf[2] * 1e2;
            f += buf[3] * 1e1;
            f += buf[4];
            return f/1e6; 
        },
        
        decodeMemory: function(buf) {
          var vfoa = this.decodeVFO(buf.slice(0,5));
          var vfob = this.decodeVFO(buf.slice(5,10));
          
          // In this code, we assume we have Xverter 1 set to 2m XV1 IF= 50MHz RF = 144MHz
          // The proper Elecraft code check the transverter actual IF and RF. This will break
          // on the 4m transverters, but I don't have one, so...
          if (buf[15] == 0x10) {
              vfoa += (144-50);
              vfob += (144-50);
          }
          
          var modes = ['CW', 'LSB', 'USB', 'DATA', 'AM', 'FM'];
          var modea = modes[buf[10] & 0xf];
          var modeb = modes[buf[10] >> 4];
          
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
          
          
          return 'This is a Frequency memory.\nVFOA: ' + vfoa + ' - VFOB: ' + vfob + '\n' +
                 'Mode A: ' + modea + ' - Mode B: ' + modeb + '\n' +
                 'Label: ' + label + ' - Description: ' + description;
          
        },
        
        showInput: function(data) {
            if (!this.$el.is(':visible')) {
                return;
            }
            var cmd = data.substr(0, 2);
            var val = data.substr(2);
            var i = $('#flashdump', this.el);
            if (cmd == "ER") {
                
                var address = parseInt(val.substr(0,4), 16);
                
                var scroll = data + '\n';
                // Add the Hex dump below:
                var buf = val.substr(6, val.length -8);
                var b = abu.hextoab(buf)
                scroll += abu.hexdump(b);
                i.val(scroll);
                
                // If we detect we have a frequency memory address, then decode what we can:
                if ((address >= 0x0c00) && (address <= 0x3Dc0) && ( address % 0x40 == 0)) {
                    i.val(i.val() + '\n' + this.decodeMemory(b));
                }
                
            } else if (data == '?') {
                i.val("Flash read error '?'");
            }
        }
    });
});