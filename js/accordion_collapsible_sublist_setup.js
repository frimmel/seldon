module.exports = function ($) {
    function setupCollapsibleSublists () {
        var app = this;
        if (app.settings && app.settings.collapsibleLists) {
            var collapseConfig = app.settings['collapsible-lists'];
            collapseConfig.forEach(function (obj) {
                if (obj.theme === app.currentTheme.label) {
                    for (var i=0; i<obj.sections.length; i++) {
                        if (obj.sections[i] === app.currentAccordionGroup.label) {
                            setupCollapsibleSublistClickHandler();
                        }
                    }
                }
            })
        }
    }

    function setupCollapsibleSublistClickHandler() {
        // Set a click handler on accordion section sublist headers
        $('.ui-accordion-content h4').on('click', function (event) {
            var $this = $(this);
            var $sublist = $this.siblings('.layer-group');
            var $icon = $this.children('.ui-icon')
            if ($sublist.hasClass('collapsed')) {
                $sublist.removeClass('collapsed');
                $icon.removeClass('ui-icon-triangle-1-e');
                $icon.addClass('ui-icon-triangle-1-s');
            } else {
                // If the sublist is uncollapse, collapse it and set the header icon
                $sublist.addClass('collapsed');
                $icon.removeClass('ui-icon-triangle-1-s');
                $icon.addClass('ui-icon-triangle-1-e');
            }
        });
    }
    return setupCollapsibleSublists;
}