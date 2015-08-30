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
window.WorkspaceListView = Backbone.View.extend({

    initialize: function () {
        
    },

    render: function () {
        var layouts = this.model.models;
        var len = layouts.length;
        var items = parseInt(this.options.settings.get('itemsperpage'));
        var startPos = (this.options.page - 1) * items;
        var endPos = Math.min(startPos + items, len);

        $(this.el).html('<ul class="thumbnails"></ul>');

        for (var i = startPos; i < endPos; i++) {
            $('.thumbnails', this.el).append(new WorkspaceListItemView({model: layouts[i], settings: this.options.settings}).render().el);
        }

        $(this.el).append(new Paginator({model: this.model, page: this.options.page, items: items}).render().el);

        return this;
    }
});

window.WorkspaceListItemView = Backbone.View.extend({

    tagName: "li",

    initialize: function () {
        this.model.bind("change", this.render, this);
        this.model.bind("destroy", this.close, this);
    },

    render: function () {
        $(this.el).html(this.template(this.model.toJSON()));
        return this;
    },
    
    events: {
        "click .edit": "editWorkspace"
    },
    
    editWorkspace: function(event) {
        var url = event.target.href.substr(event.target.baseURI.length);
        app.navigate(url, {trigger: true});
        event.stopPropagation();
    },

});