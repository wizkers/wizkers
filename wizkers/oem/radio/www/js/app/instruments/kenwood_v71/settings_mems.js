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
 * V71A Memory editor
 *
 * @author Edouard Lafargue, ed@lafargue.name
 *
 */

define(function(require) {
    "use strict";

    var abu = require('app/lib/abutils'),
        template = require('js/tpl/instruments/kenwood_v71/SettingsMems.js');

    // We also have base variables across the functions:
    var modes = ['FM', 'NFM', 'AM'];
    var tones = ['67.0', '69.3', '71.9','74.4', '77.0', '79.7', '82.5', '85.4', '88.5', '91.5', '94.8', '97.4', '100.0',
                        '103.5', '107.2', '110.9', '114.8', '118.8', '123.0', '127.3', '131.8', '136.5', '141.3', '146.2',
                        '151.4', '156.7', '159.8', '162.2', '165.5', '167.9', '171.3', '173.8', '177.3', '179.9', '183.5',
                        '186.2', '189.9', '192.8', '196.6', '199.5', '203.5', '206.5', '210.7', '218.1', '225.7', '229.1',
                        '233.6', '241.8', '250.3', '254.1', '1750.0'];
    var dcs_codes = [ 23,25,26,31,32,36,43,47,51,53,54,65,71,72,73,74,114,115,116,122,125,131,132,
                      134,143,145,152,155,156,162,165,172,174,205,212,223,225,226,243,244,245,246,251,252,255,261,
                      263,265,266,271,274,306,311,315,325,331,332,343,346,351,356,364,365,371,411,412,413,423,431,
                      432,445,446,452,454,455,462,464,465,466,503,506,516,523,565,532,546,565,606,612,624,627,631,
                      632,654,662,664,703,712,723,731,732,734,743,754
                      ];
    var sql_modes = [ 'None', 'Tone', 'CTCSS', 'DCS'];

    return (function() {

        var readingAllMemsIndex = 0,
            view;

            /**
             * Asynchronous poll of all radio memories. Since we have 1000 memorie,
             * creating 1000 lines of 10 elements slows down our interface a lot,
             * so we should memorize everything and only display pages of 100 memories
             * that we generate on the fly - this is a TODO
             */
        var getAllMemsLoop = function() {
            if (readingAllMemsIndex < 1000) {
                // Gets both memory and memory name
                linkManager.sendCommand({command: 'get_memory', arg:readingAllMemsIndex++});
            }
        };

        /**
         * Creates a HTML snippet with the mode selected
         */
        var makeModeDropdown = function(mode) {
            var html = '<select style="width: 100%;" class="form-control menu-dropdown vfo-mode">';
            // Depending on datarev and cwrev, we must update the actual mode name:
            var text = modes[mode];
            for (var m in modes) {
                html += '<option value="' + modes[m] + '" ' + (text == modes[m] ? 'selected' : '') + ' >' + modes[m] + '</option>';
            }
            html += '</select>';
            return html;
        };


        /**
         * Works for both tones and CTCSS tones (separate on the V71A)
         */
        var makePLToneDropdown = function(tone,cl) {
            var html = '<select style="width: 100%;" class="form-control menu-dropdown ' + cl + '">';
            for (var t in tones) {
                html += '<option value="' + tones[t] + '" ' + (tone == t ? 'selected' : '') + ' >' + tones[t] + '</option>';
            }
            html += '</select>';
            return html;
        };

        var makeDCSCodeDropdown = function(code) {
            var html = '<select style="width: 100%;" class="form-control menu-dropdown dcs-code">';
            for (var t in dcs_codes) {
                html += '<option value="' + dcs_codes[t] + '" ' + (code == t ? 'selected' : '') + ' >' + dcs_codes[t] + '</option>';
            }
            html += '</select>';
            return html;
        };

        var makeSQLModeDropdown = function(tone_on, ct_on, dcs_on) {
            var html = '<select style="width: 100%;" class="form-control menu-dropdown sql-mode">';
            var n = tone_on || ct_on || dcs_on;
            html += '<option value="none" ' + ( n == 0 ? 'selected' : '') + '>None</option>';
            html += '<option value="tone" ' + (tone_on ? 'selected' : '') + '>Tone</option>';
            html += '<option value="ctcss" ' + (ct_on ? 'selected': '') + '>CTCSS</option>';
            html += '<option value="dcs" ' + (dcs_on ? 'selected' : '') + '>DCS</option>';
            html += '</select>';
            return html;
        };

        var makeVFO = function(vfo, xvrt) {
            // Return a Hex string encoding for the VFO value
            vfo = ('00000000' + vfo.toString()).slice(-8);
            var buf = '';
            for (var i = 0; i < 3; i++) {
                buf += ('00' + parseInt(vfo.substr(i*2, 2)).toString(16)).slice(-2);
            }
            buf += ('00' + parseInt(vfo[6]).toString(16)).slice(-2);
            buf += ('00' + parseInt(vfo[7]).toString(16)).slice(-2);
            return buf;
        };

        var decodeMemory = function(mem) {
          // Detect an unused memory and bail early
          if (mem.empty) {
            var row = '<tr id="mem-idx-' + mem.index + '"><td><button class="btn btn-default memory-channel" data-channel="' + mem.index + '">' + mem.index + '</button></td>';
          row += '<td><input class="f-label form-control" size="6" maxlength="6" value=""></td>';
          row += '<td><input class="f-vfoa form-control"  value=""></td>';
          row += '<td>' + makeModeDropdown(0, 'f-modea') + '</td>';
          row += '<td>' + makeSQLModeDropdown(false, false, false) + '</td>';
          row += '<td>' + makePLToneDropdown(0, 'vfo-tone') + '</td>';
          row += '<td>' + makePLToneDropdown(0, 'vfo-ctcss') + '</td>';
          row += '<td>' + makeDCSCodeDropdown(0) + '</td>';
          row += '<td><input class="f-offset form-control"  value="0"></td>';
          row += '<td><button class="btn btn-default save-channel" data-channel="' + mem.index + '"><span data-channel="' + mem.index + '" class="glyphicon glyphicon-upload"></span></td>';
          row += '</tr>';
            view.$('#freqtable' + Math.floor(mem.index/100)).append(row);
            return;
          }

          // Create a table row:
          var row = '<tr id="mem-idx-' + mem.index + '"><td><button class="btn btn-default memory-channel" data-channel="' + mem.index + '">' + mem.index + '</button></td>';
          row += '<td><input class="f-label form-control" size="6" maxlength="6" value="' + mem.name + '"></td>';
          row += '<td><input class="f-vfoa form-control"  value="' + mem.freq/1e6 + '"></td>';
          row += '<td>' + makeModeDropdown(mem.mode, 'f-modea') + '</td>';
          row += '<td>' + makeSQLModeDropdown(mem.tone_on, mem.ct_on, mem.dcs_on) + '</td>';
          row += '<td>' + makePLToneDropdown(mem.tone_freq, 'vfo-tone') + '</td>';
          row += '<td>' + makePLToneDropdown(mem.ct_freq, 'vfo-ctcss') + '</td>';
          row += '<td>' + makeDCSCodeDropdown(mem.dcs_code) + '</td>';
          row += '<td><input class="f-offset form-control"  value="' + mem.offset_freq/1e6 + '"></td>';

          row += '<td><button class="btn btn-default save-channel" data-channel="' + mem.index + '"><span data-channel="' + mem.index + '" class="glyphicon glyphicon-upload"></span></td>';
          row += '</tr>';

          view.$('#freqtable' + Math.floor(mem.index/100)).append(row);

        };


        var makeMemory = function(e) {
            var mem = $(e.target).data('channel');
            var id = '#mem-idx-' + mem;
            // check we really do have a memory to create:
            if (view.$(id).length == 0)
                return;
            id += ' .';
            var sqlmode = view.$(id + 'sql-mode').val();
            // Note: we should keep all info as explicit (FM, NFM, etc, not codes),
            // and the backend driver will convert. This way we can edge towards
            // generic memory editors that work on multiple radios.
            var memjson = {
                index: mem,
                name: view.$( id + 'f-label').val(),
                freq: view.$(id + 'f-vfoa').val(),
                mode: view.$(id + 'vfo-mode').val(),
                offset: view.$(id + 'f-offset').val(),
                tone_on: sqlmode == 'tone',
                ct_on: sqlmode == 'ctcss',
                dcs_on: sqlmode == 'dc s',
                tone_freq: view.$(id + 'vfo-tone').val(),
                ct_freq: view.$(id + 'vfo-ctcss').val(),
                dcs_code: view.$(id + 'dcs-code').val()
            };

            console.info(memjson);
            linkManager.sendCommand({command: 'set_memory', arg: memjson});

        };

        var showInput = function(data) {
            if (!view.$el.is(':visible')) {
                return;
            }

            if (data.op && (data.op == 'set_memory')) {
                if (data.error) {
                    $('.save-channel[data-channel="' + data.index + '"]').addClass('btn-danger').removeClass('btn-success');
                } else {
                    $('.save-channel[data-channel="' + data.index + '"]').addClass('btn-success').removeClass('btn-danger');
                }
            }

            if (data.memory) {
                decodeMemory(data.memory);
                getAllMemsLoop();
            }
        }


    /**
     * The actual view
     */
    return Backbone.View.extend({

        initialize:function () {
            linkManager.on('input', showInput, this);
            view = this;
        },

        events: {
            "click #memread": "readMemoryManual",
            "click #readmems": "getAllMems",
            "click .memory-channel": "tuneMem",
            "click .save-channel": "mm"
        },

        onClose: function() {
            console.info('[Kenwood V71] Frequency List view closing');
            linkManager.off('input', showInput);
        },

        render:function () {
            var self = this;
            this.$el.html(template());
            return this;
        },

        refresh: function() {
            // Now, we only want to scroll the table, not the whole page.
            // We have to do this because the offset is not computed before
            // we show the tab for the first time.
            var tbheight = window.innerHeight - $(this.el).offset().top - 150;
            this.$('.tablewrapper').css('max-height', tbheight + 'px');

        },

        /**
         * Tune to a direct mem
         */
        tuneMem: function(e) {
            var mem = $(e.target).data('channel');
            linkManager.driver.memoryChannel(mem);
        },

        /**
         * Read all radio memories
         */
        getAllMems: function() {
            readingAllMemsIndex = 0;
            getAllMemsLoop();
        },

        mm: function(e) {
            makeMemory(e);
        }

    });

    })();
});