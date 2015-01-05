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

/**
 * Encapsulates a list of items into a paged view
 *
 * Parts of this code coming from Christophe Coenraets
 */

define(function(require) {
    
    "use strict";
    
    var $       = require('jquery'),
        Backbone = require('backbone');

    return Backbone.View.extend({

        className: "container center",

        initialize:function (options) {
            this.options = options || {};
            this.model.bind("reset", this.render, this);
        },

        render:function () {

            var items = this.model.models;
            var len = items.length;
            var pageCount = Math.ceil(len / this.options.items);

            $(this.el).html('<ul class="pagination" />');

            for (var i=0; i < pageCount; i++) {
                $('ul', this.el).append("<li" + ((i + 1) === this.options.page ? " class='active'" : "") + "><a href='#" +
                                        this.options.viewname + "/page/"+(i+1)+"'>" + (i+1) + "</a></li>");
            }

            return this;
        }
    });
});