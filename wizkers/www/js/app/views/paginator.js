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
            var len = items.length +1; // +1 for the "Add" card at the end.
            var pageCount = Math.ceil(len / this.options.items);

            this.$el.html('<ul class="pagination" />');

            for (var i=0; i < pageCount; i++) {
                $('ul', this.el).append("<li" + ((i + 1) === this.options.page ? " class='active'" : "") + "><a href='#" +
                                        this.options.viewname + "/page/"+(i+1)+"'>" + (i+1) + "</a></li>");
            }

            return this;
        }
    });
});