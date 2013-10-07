window.HeaderView = Backbone.View.extend({

    initialize: function () {
        this.render();
    },

    render: function () {
        $(this.el).html(this.template());
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