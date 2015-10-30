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

/**
 *  Configuration widget for a remote connection over WebRTC
 * @author Edouard Lafargue, ed@lafargue.name
 */
define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        template = require('tpl/connections/webrtc');

    return Backbone.View.extend({

        initialize: function (options) {
            // Initialize Helium-specific attributes:
            if (this.model.get('webrtc') == undefined) {
                this.model.set('webrtc', {
                    host: '127.0.0.1',
                    port: 9000,
                    provider: 'custom'
                });
            }
        },

        render: function () {
            this.$el.html(template(this.model.toJSON()));
            return this;
        }

    });
});