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

/*
 * Live view display of the output of a simple serial device
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        abutils = require('app/lib/abutils'),
        template = require('js/tpl/instruments/SimpleSerialLiveView.js');

    // Load the jQuery terminal plugin
    // (be sure to define it in the global requirejs config
    //require('terminal');
    var Terminal = require('lib/term');

    return Backbone.View.extend({

        initialize: function (options) {
            this.scrollback = parseInt(this.model.get('metadata').lines) || 200;
            this.parser_option = "raw";
            linkManager.on('status', this.updatestatus, this);
            linkManager.on('input', this.showInput, this);
            this.lastOutput = 0;
            this.lastHex = '';
        },

        events: {},

        handleKeypress: function (data) {
            linkManager.sendCommand(data);
        },

        render: function () {
            var self = this;
            console.log('Main render of Simple Serial live view');
            this.term = new Terminal({
                cols: 80,
                rows: 24,
                scrollback: this.scrollback,
                cursorBlink: true,
                useStyle: false, // Use the default styling from term.js
            });
            this.$el.html(template({bg:this.term.colors[256], fg: this.term.colors[257]}));

            this.term.open($('#terminal', this.el)[0]);
            this.term.on('data', this.handleKeypress);

            // We know that our font size is about 7px wide (monospace with 12px height),
            // so we resize the terminal dynamically:
            var rsc = function () {
                    console.log("Window resized (Serial term)");
                    var termheight = window.innerHeight - $(self.el).offset().top - 30;
                    if (settings.get("showstream"))
                        termheight -= ($('#showstream').height() + 20);
                    $('#terminal', self.el).css('height',termheight + 'px');
                    // Get the line height:
                    var lhpx = getComputedStyle($('.terminal',self.el)[0]).lineHeight;
                    var lh = parseInt(lhpx.substring(0,lhpx.length-1));
                    self.term.resize(Math.floor($('#terminal').width()/7), Math.floor(termheight/lh));
            }
            this.rsc = rsc;
            $(window).on('resize', this.rsc);
            rsc();

            linkManager.requestStatus();
            return this;
        },

        onClose: function () {
            console.log("Simple Serial live view closing...");
            this.term.destroy();
            $(window).off('resize', this.rsc);
            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.showInput);
        },

        updatestatus: function (data) {},

        // Called by the Num View
        update_parser: function (e) {
            this.parser_option = $(e.target).val();
        },

        // We get there whenever we receive something from the serial port
        showInput: function (data) {
            var output = '';
            switch (this.parser_option) {
            case 'Hexadecimal':
                output = abutils.hexdump(data);
                this.term.write(output + '\r');
                break;
            default:
                output = data;
                this.term.write(output);
                break;
            }
        },
    });

});