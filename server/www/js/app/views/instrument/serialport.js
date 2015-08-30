/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
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
        template = require('tpl/connections/serialport');

    return Backbone.View.extend({

        initialize: function (options) {
            console.log(options);
            this.ports = options.ports;
            linkManager.on('ports', this.refreshDevices);

        },

        events: {
            "click #refresh": "refresh"
        },

        onClose: function () {
            console.log("Serial connexion settings closing");
            linkManager.off('ports', this.refreshDevices);
        },


        render: function () {
            $(this.el).html(template(_.extend(this.model.toJSON(), {
                ports: this.ports
            })));
            return this;
        },

        refreshDevices: function (devices) {
            this.ports = devices;
            this.render;
        },

        refresh: function () {
            // Catch a "Refresh" value here which indicates we should
            // just ask for a list of ports again:
            var insType = this.model.get('type');
            linkManager.getPorts(insType);
        }


    });
});