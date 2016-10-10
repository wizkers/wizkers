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
 * Render a carousel of frequency memories, handle editing and updating.
 * @author Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */
define(function (require) {
    "use strict";

    var Snap = require('snap'),
        template = require('js/tpl/instruments/kenwood_v71/SettingsMems.js');


    return Backbone.View.extend({

        initialize: function (options) {
            this.options = options || {};
            this.current_tab_shown = 0;

            // The server lets us specify free-form metadata for each instrument,
            // we are using it for storing our frequencies.
            //
            var metadata = this.model.get('metadata');
            this.frequencies = metadata.frequencies;
            if (this.frequencies == null) {
                console.warn('Need to refresh radio frequencies!')
                this.frequencies = [];
            }
        },

        render: function () {
            this.$el.html(template());
            this.$('#readmems').hide(); // We only sync/read in the "Device Setup" screen.
            if (this.frequencies.length > 0) {
                this.$('#freqtable0').append('<tr><th>Tune</th><th>#</th><th>Name</th><th>Freq</th><th>Mode</th><th>SQL Mode</th><th>Tone</th><th>CTCSS</th><th>DCS</th><th>Duplex</th><th>Offset</th></tr>');
                this.makeFrequencyGroup(0, 100);
            } else {
                this.$('#freqtable0').append('<tr><th>Not synchronized with your radio yet: Connect, go to "Device Setup" then "Memories" to read all memories</th></tr>');
            }
            return this;
        },

        events: {
            'click .memory-channel': 'tuneMem',
            'shown.bs.tab a[data-toggle="tab"]': 'tab_shown'

        },

        tab_shown: function(e) {
            // Empty the previous table and populate the current tab.
            // This is because we other end up with 10k + DOM elements that
            // end up really slowing down the app. HTML5, Javascript, gotta love it.
            this.$('#freqtable' + this.current_tab_shown).empty();
            this.current_tab_shown = parseInt(e.target.innerText[0]);
            this.$('#freqtable' + this.current_tab_shown).append('<tr><th>Tune</th><th>#</th><th>Name</th><th>Freq</th><th>Mode</th><th>SQL Mode</th><th>Tone</th><th>CTCSS</th><th>DCS</th><th>Duplex</th><th>Offset</th></tr>');
            this.makeFrequencyGroup(this.current_tab_shown *100, (this.current_tab_shown+1) * 100);

        },

        makeFrequencyGroup: function(idx,upper) {
            while (idx < upper) {
                if (this.frequencies[idx]) {
                    this.decodeMemory(this.frequencies[idx++]);
                } else {
                    break;
                }
            }
            var tbheight = window.innerHeight - $(this.el).offset().top - 150;
            this.$('.tablewrapper').css('max-height', tbheight + 'px');
        },

        tuneMem: function(e) {
            var mem = $(e.target).data('channel');
            var vfo = $(e.target).data('vfo');
            linkManager.driver.memoryChannel({vfo:vfo, channel:mem});
        },

        SQLMode: function(tone,ct,dcs) {
            if (tone)
                return 'Tone';
            if (ct)
                return 'CTCSS';
            if (dcs)
                return 'DCS';
            return 'None';
        },

        /**
         * Build a table row using a memory description. Node: the properties
         * of the memory are device-agnostic as much as possible
         */
        decodeMemory: function(mem) {
          // Detect an unused memory and bail early
          if (mem.empty) {
            return;
          }

          // Create a table row:
          var row ='<tr id="mem-idx-' + mem.index + '"><td><button class="btn btn-default memory-channel" data-vfo="a" data-channel="' + mem.index + '">A</button>';
          row += '&nbsp;<button class="btn btn-default memory-channel" data-vfo="b" data-channel="' + mem.index + '">B</button></td>';
          row += '<td>' +mem.index + '</td>';
          row += '<td>' + mem.name + '</td>';
          row += '<td>' + mem.freq/1e6 + '</td>';
          row += '<td>' + mem.mode + '</td>';
          row += '<td>' + this.SQLMode(mem.tone_on, mem.ct_on, mem.dcs_on) + '</td>';
          row += '<td>' + mem.tone_freq + '</td>';
          row += '<td>' + mem.ct_freq + '</td>';
          row += '<td>' + mem.dcs_code + '</td>';
          row += '<td>' + mem.duplex + '</td>';
          row += '<td>'  + mem.offset_freq/1e6 + '</td>';
          row += '</tr>';

          this.$('#freqtable' + Math.floor(mem.index/100)).append(row);

        },


        refresh: function () {
        },

        onClose: function () {
            console.log("Frequency list closing");
        },

    });
});