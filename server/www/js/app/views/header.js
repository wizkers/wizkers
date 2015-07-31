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
define(function(require) {
    
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/HeaderView.js');

    return Backbone.View.extend({

        initialize: function () {
            this.render();
        },

        render: function () {
            $(this.el).html(template());
            if (vizapp.type == 'server') {
                // If we're running with a backend server, we need to hide some elements
                // in case we are only a 'viewer'. This is not relevant if we're running as an app,
                // since we're always an admin there
                if (settings.get('currentUserRole') == 'viewer') {
                    //$('.instrument-menu', this.el).hide();
                    $('.settings-menu', this.el).hide();
                }
            }
            return this;
        },

        selectMenuItem: function (menuItem) {
            $('.nav li').removeClass('active');
            $('.nav .add-option').hide();
            if (menuItem) {
                $('.' + menuItem).addClass('active');
                $('.' + menuItem + '-add').show();
            }
        }
    });
    
});