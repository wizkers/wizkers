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
 * @author Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */
define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        template = require('tpl/connections/dummy');

    return Backbone.View.extend({

        initialize: function (options) {
            console.log(options);
            this.ports = options.ports;
            if (this.model.get('tcpip') == undefined) {
                this.model.set('tcpip', {
                    host: '127.0.0.1',
                    port: 7373,
                    proto: 'tcp'
                });
            }

            this.refresh();
        },

        events: {
            "click #refresh": "refresh",
            "change #port": "toggleTcp"
        },

        onClose: function () {
            console.log("Dummy connection settings closing");
        },

        render: function () {
            this.$el.html(template(_.extend(this.model.toJSON(), {
                ports: this.ports
            })));
            if (this.model.get('port') != 'TCP/IP')
                $('.hide-tcp', this.el).hide();

            return this;
        },

        toggleTcp: function (e) {
            if (e.target.value == 'TCP/IP')
                $('.hide-tcp', this.el).show();
            else
                $('.hide-tcp', this.el).hide();
        },

        refreshDevices: function (devices) {
            this.ports = devices;
            this.render();
        },

        refresh: function () {
            // Catch a "Refresh" value here which indicates we should
            // just ask for a list of ports again:
            var insType = this.model.get('type');
            linkManager.once('ports', this.refreshDevices, this);
            linkManager.getPorts(insType);
        }

    });
});