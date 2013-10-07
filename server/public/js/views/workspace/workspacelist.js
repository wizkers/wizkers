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