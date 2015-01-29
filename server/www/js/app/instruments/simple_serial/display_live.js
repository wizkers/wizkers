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
        utils = require('app/utils'),
        template = require('js/tpl/instruments/SimpleSerialLiveView.js');

    // Load the jQuery terminal plugin
    // (be sure to define it in the global requirejs config
    require('terminal');

    return Backbone.View.extend({

        initialize: function (options) {
            this.scrollback = this.model.get('metadata').lines;
            linkManager.on('status', this.updatestatus, this);
            linkManager.on('input', this.showInput, this);
        },

        events: {},

        handleTerminal: function (command, term) {
            if (command !== '') {
                linkManager.sendCommand(command);
            };
        },


        render: function () {
            var self = this;
            console.log('Main render of Simple Serial live view');
            $(this.el).html(template());
            this.term = $('#terminal').terminal(this.handleTerminal, {});

            linkManager.requestStatus();
            return this;
        },

        onClose: function () {
            console.log("Simple Serial live view closing...");
            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.showInput);
        },

        updatestatus: function (data) {
            console.log("Simple Serial live display: serial status update");
        },

        // We get there whenever we receive something from the serial port
        showInput: function (data) {
            this.term.echo(data);
        },
    });

});