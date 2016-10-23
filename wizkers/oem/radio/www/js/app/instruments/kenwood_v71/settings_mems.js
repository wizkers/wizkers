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
 * V71A Memory editor. The goal is to progressively turn this into a fully
 * generic radio memory editor.
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
    var tones = []; // We ask the backend driver for the tones the radio supports

    var dcs_codes = [ 23,25,26,31,32,36,43,47,51,53,54,65,71,72,73,74,114,115,116,122,125,131,132,
                      134,143,145,152,155,156,162,165,172,174,205,212,223,225,226,243,244,245,246,251,252,255,261,
                      263,265,266,271,274,306,311,315,325,331,332,343,346,351,356,364,365,371,411,412,413,423,431,
                      432,445,446,452,454,455,462,464,465,466,503,506,516,523,565,532,546,565,606,612,624,627,631,
                      632,654,662,664,703,712,723,731,732,734,743,754
                      ];
    var duplex_options = [ 'Off', '+', '-', 'Split'];
    var sql_modes = [ 'None', 'Tone', 'CTCSS', 'DCS'];
    var tune_steps = [ '5.0', '6.25', '8.33', '10.0', '12.5', '15.0', '20.0', '25.0', '30.0', '50.0', '100.0'];

    var memories = [];
    var current_tab_shown = 0;

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
            } else {
                // Save our memories into our settings, so that they can be retrieved in the
                // live view ASAP
                var i = instrumentManager.getInstrument();
                var md = i.get('metadata');
                i.set('metadata', {
                    "frequencies": memories
                });
                i.save(null); // TODO: success/failure tracking
            }
        };

        var makeFrequencyGroup = function(idx,upper) {
            while (idx < upper) {
                if (memories[idx]) {
                    decodeMemory(memories[idx++]);
                } else {
                    break;
                }
            }
            var tbheight = window.innerHeight - $(view.el).offset().top - 150;
            view.$('.tablewrapper').css('max-height', tbheight + 'px');
        }

        /**
         * Creates a HTML snippet with the mode selected
         */
        var makeModeDropdown = function(mode) {
            return makeGenericDropdown(mode, 'vfo-mode', modes);
        };

        /**
         * Works for both tones and CTCSS tones (separate on the V71A)
         */
        var makePLToneDropdown = function(tone,cl) {
            return makeGenericDropdown(tone,cl,tones);
        };

        var makeDCSCodeDropdown = function(code) {
            return makeGenericDropdown(code, 'dcs-code', dcs_codes);
        };

        var makeDuplexDropdown = function(duplex,cl) {
            return makeGenericDropdown(duplex,cl,duplex_options);
        };

        var makeTuneStepDropdown = function(step,cl) {
            return makeGenericDropdown(step,cl,tune_steps);
        };

        var makeGenericDropdown = function(val,cl, options) {
            var html = '<select style="width: 100%;" class="form-control menu-dropdown ' + cl + '">';
            for (var t in options) {
                html += '<option value="' + options[t] + '" ' + (val == options[t] ? 'selected' : '') + ' >' + options[t] + '</option>';
            }
            html += '</select>';
            return html;
        }


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

        /**
         * Build a table row using a memory description. Node: the properties
         * of the memory are device-agnostic as much as possible
         */
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
          row += '<td>' + makeDuplexDropdown(0, 'vfo-duplex') + '</td>';
          row += '<td><input class="f-offset form-control"  value="0"></td>';
          row += '<td>' + makeTuneStepDropdown(0,'vfo-step') + '</td>';
          row += '<td style="vertical-align:middle"> <input type="checkbox" class="vfo-skip"></td>';
          row += '<td><button class="btn btn-default save-channel" data-channel="' + mem.index + '"><span data-channel="' + mem.index + '" class="glyphicon glyphicon-upload"></span></td>';
          row += '</tr>';
            view.$('#freqtable' + Math.floor(mem.index/100)).append(row);
            return;
          }

          // Create a table row:
          var row = '<tr id="mem-idx-' + mem.index + '"><td><button class="btn btn-default memory-channel" data-channel="' + mem.index + '">' + mem.index + '</button></td>';
          row += '<td><input class="f-label form-control" size="6" maxlength="6" value="' + mem.name + '"></td>';
          row += '<td><input class="f-vfoa form-control"  size="9" maxlength="9" value="' + mem.freq/1e6 + '"></td>';
          row += '<td>' + makeModeDropdown(mem.mode, 'f-modea') + '</td>';
          row += '<td>' + makeSQLModeDropdown(mem.tone_on, mem.ct_on, mem.dcs_on) + '</td>';
          row += '<td>' + makePLToneDropdown(mem.tone_freq, 'vfo-tone') + '</td>';
          row += '<td>' + makePLToneDropdown(mem.ct_freq, 'vfo-ctcss') + '</td>';
          row += '<td>' + makeDCSCodeDropdown(mem.dcs_code) + '</td>';
          row += '<td>' + makeDuplexDropdown(mem.duplex, 'vfo-duplex') + '</td>';
          row += '<td><input class="f-offset form-control" size="9" maxlength="9"  value="' + mem.offset_freq/1e6 + '"></td>';
          row += '<td>' + makeTuneStepDropdown(mem.step,'vfo-step') + '</td>';
          row += '<td style="vertical-align:middle"> <input type="checkbox" class="vfo-skip" ' + (mem.skip ? 'checked' : '') + '></td>';
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
                freq: parseFloat(view.$(id + 'f-vfoa').val()) * 1e6,
                mode: view.$(id + 'vfo-mode').val(),
                offset_freq: parseFloat(view.$(id + 'f-offset').val()) * 1e6,
                duplex: view.$(id + 'vfo-duplex').val(),
                step: view.$(id + 'vfo-step').val(),
                skip: view.$(id + 'vfo-skip').is(':checked'),
                tone_on: sqlmode == 'tone',
                ct_on: sqlmode == 'ctcss',
                dcs_on: sqlmode == 'dc s',
                tone_freq: parseFloat(view.$(id + 'vfo-tone').val()),
                ct_freq: parseFloat(view.$(id + 'vfo-ctcss').val()),
                dcs_code: parseInt(view.$(id + 'dcs-code').val())
            };

            console.info(memjson);
            memories[mem] = memjson; // Don't forget to update our own memory cache!
            linkManager.sendCommand({command: 'set_memory', arg: memjson});

        };

        var showInput = function(data) {
            if (data.tones) {
                tones = data.tones;
                return;
            }

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
                // Add to our memories
                memories.push(data.memory);
                // Only populate the first page during scan
                if (data.memory.index == 0) {
                    this.$('#freqtable0').append('<tr><th>ID</th><th>Name</th><th>Freq</th><th>Mode</th><th>SQL Mode</th><th>Tone</th><th>CTCSS</th><th>DCS</th><th>Duplex</th><th>Offset</th><th>Tune Step</th><th>Skip</th></tr>');
                }
                if (data.memory.index < 100)
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
            var i = instrumentManager.getInstrument();
            memories = i.get('metadata').frequencies;
            if (memories == null) {
                console.warn('Need to refresh radio frequencies!')
                memories = [];
            }
        },

        events: {
            "click #memread": "readMemoryManual",
            "click #readmems": "getAllMems",
            "click .save-channel": "mm",
            'shown.bs.tab a[data-toggle="tab"]': "tab_shown"
        },

        onClose: function() {
            console.info('[Kenwood V71] Frequency List view closing');
            linkManager.off('input', showInput);
            // Update all the memories in our settings:
            var i = instrumentManager.getInstrument();
            var md = i.get('metadata');
            i.set('metadata', {
                "frequencies": memories
            });
            i.save(null); // TODO: success/failure tracking
        },

        render:function () {
            this.$el.html(template());
            linkManager.sendCommand({command: 'get_tones'});
            if (memories.length > 0) {
                this.$('#freqtable0').append('<tr><th>ID</th><th>Name</th><th>Freq</th><th>Mode</th><th>SQL Mode</th><th>Tone</th><th>CTCSS</th><th>DCS</th><th>Duplex</th><th>Offset</th><th>Tune Step</th><th>Skip</th></tr>');
                makeFrequencyGroup(0, 100);
            } else {
                this.$('#freqtable0').append('<tr><th>Not synchronized with your radio yet: click on "Read from radio" to get your radio memories</th></tr>');
            }
            return this;
        },

        refresh: function() {
            // Now, we only want to scroll the table, not the whole page.
            // We have to do this because the offset is not computed before
            // we show the tab for the first time.
            var tbheight = window.innerHeight - $(this.el).offset().top - 150;
            this.$('.tablewrapper').css('max-height', tbheight + 'px');

        },

        tab_shown: function (e) {
            // Empty the previous table and populate the current tab.
            // This is because we other end up with 10k + DOM elements that
            // end up really slowing down the app. HTML5, Javascript, gotta love it.
            this.$('#freqtable' + current_tab_shown).empty();
            current_tab_shown = parseInt(e.target.innerText[0]);
            this.$('#freqtable' + current_tab_shown).append('<tr><th>ID</th><th>Name</th><th>Freq</th><th>Mode</th><th>SQL Mode</th><th>Tone</th><th>CTCSS</th><th>DCS</th><th>Duplex</th><th>Offset</th><th>Tune Step</th><th>Skip</th></tr>');
            makeFrequencyGroup(current_tab_shown *100, (current_tab_shown+1) * 100);
        },

        /**
         * Read all radio memories
         */
        getAllMems: function() {
            readingAllMemsIndex = 0;
            memories = [];
            for (var i =0; i <10;i++)
                this.$('#freqtable' + i).empty();
            getAllMemsLoop();
        },

        mm: function(e) {
            makeMemory(e);
        }

    });

    })();
});