'use strict';

var drw_polygon = angular.module('drwPolygon', []);

drw_polygon.directive('drwPolygon', [function () {
    return {
        restrict: 'AE',
        scope: {
            width: '=',
            height: '=',
            regions: '=',
            imgUrl: '=?',
            enabled: '=?'
        },
        controller: function () {

        },
        link: function (scope, element, attrs, ctrl) {
            var img_scale = {
                'x': 1.0,
                'y': 1.0
            };
            var image;
            var new_region_index;

            // enabled is optional, if not given, default to true
            if (scope.enabled === undefined) {
                scope.enabled = true;
            }

            // has_active_region controls whether new mouse up events
            // will start the first point for a new region or add another
            // point to the region currently being drawn
            var has_active_region = false;

            var $svg = $('#drw-poly');
            $svg
                .attr("width", scope.width + 'px')
                .attr("height", scope.height + 'px');

            scope.$watch('imgUrl', function() {
                if (scope.imgUrl === null) {
                    return;
                }

                image = new Image();

                scope.calc_img_scale = function () {
                    img_scale.x = this.width / scope.width;
                    img_scale.y = this.height / scope.height;
                };
                $(image).load(scope.calc_img_scale);

                image.src = scope.imgUrl;
            });

            scope.$watch('regions', function () {
                console.log('regions changed ' + scope.regions.length);
                // Clear all existing polygons and handles
                $('svg#drw-poly > polygon').remove();
                $('svg#drw-poly > rect').remove();

                scope.regions.forEach(function (region) {
                    create_region();
                    region.forEach(function (point) {
                        create_point(
                            Math.round(point[0] / img_scale.x),
                            Math.round(point[1] / img_scale.y)
                        )
                    });
                });

                deactivate_region();
                reindex_polygons();
            });

            var deactivate_region = function () {
                $('rect.handle').remove();
                has_active_region = false;
            };

            var setup_handle = function(point, polygon) {
                var handle = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'rect'
                );
                handle.setAttribute('class', 'handle');
                handle.setAttribute('x', (point.x - 3).toString());
                handle.setAttribute('y', (point.y - 3).toString());
                handle.setAttribute('width', '6');
                handle.setAttribute('height', '6');
                $(handle).draggable(
                    {
                        start: function (event) {
                            $svg.off('mouseup');
                        },
                        drag: function (event) {
                            point.x = event.offsetX;
                            point.y = event.offsetY;
                            event.target.setAttribute('x', (point.x - 3).toString());
                            event.target.setAttribute('y', (point.y - 3).toString());
                        },
                        stop: function (event) {
                            var region_index = parseInt(polygon.attributes['drw-index'].value);
                            scope.regions[region_index] = [];

                            for (var i = 0; i < polygon.points.length; i++) {
                                scope.regions[region_index].push(
                                    [
                                        Math.round(polygon.points[i].x * img_scale.x),
                                        Math.round(polygon.points[i].y * img_scale.y)
                                    ]
                                )
                            }

                            $svg.on('mouseup', mouseup);
                        }
                    }
                );

                $(handle).bind('contextmenu', function (evt) {
                    // Disable context menu for handles, right clicking
                    // will be used to delete region vertices
                    //
                    // Also, SVGPointList doesn't behave like an Array, and
                    // does not implement indexOf, yet points can only be removed
                    // by index. So, I bit of a hack using angular.equals to
                    // find the point to remove
                    var region_index = parseInt(scope.poly_el.attributes['drw-index'].value);

                    for (var i = 0; i < scope.poly_el.points.length; i++) {
                        if (angular.equals(scope.poly_el.points.getItem(i), point)) {
                            scope.poly_el.points.removeItem(i);
                            scope.regions[region_index].splice(i, 1);
                            break;
                        }
                    }

                    $(evt.target).remove();

                    return false;
                });

                return handle;
            };

            var select_region = function (evt) {
                if (!scope.enabled) {
                    return false;
                }

                if (!has_active_region && evt.button === 0) {
                    evt.stopPropagation();

                    for (var i = 0; i < evt.target.points.length; i++) {
                        var handle = setup_handle(
                            evt.target.points.getItem(i),
                            evt.target
                        );
                        $(handle).appendTo($svg);
                    }
                    has_active_region = true;
                    scope.poly_el = evt.target;
                }
            };

            var reindex_polygons = function () {
                var polygons = $('svg#drw-poly > polygon');
                for (var i = 0; i < polygons.length; i++) {
                    polygons[i].setAttribute('drw-index', i.toString());
                }
            };

            var delete_region = function (region) {
                deactivate_region();
                var region_index = parseInt(region.attributes['drw-index'].value);
                region.remove();
                reindex_polygons();
                scope.regions.splice(region_index, 1);
            };

            var create_region = function () {
                new_region_index = scope.regions.length;
                scope.regions.push([]);
                has_active_region = true;

                scope.poly_el = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'polygon'
                );
                scope.poly_el.setAttribute('drw-index', new_region_index);
                scope.active_poly = $(scope.poly_el).appendTo($svg);
                $(scope.active_poly).bind('contextmenu', function (evt) {
                    return false;
                });
                $(scope.active_poly).on('mouseup', select_region);
            };

            var create_point = function (x, y) {
                var point = $svg[0].createSVGPoint();
                point.x = x;
                point.y = y;

                if (!has_active_region) {
                    // create new region
                    create_region();
                }

                scope.poly_el.points.appendItem(point);
                var region_index = parseInt(scope.poly_el.attributes['drw-index'].value);
                scope.regions[region_index].push(
                    [
                        Math.round(point.x * img_scale.x),
                        Math.round(point.y * img_scale.y)
                    ]
                );

                var handle = setup_handle(point, scope.poly_el);
                scope.active_poly = $(handle).appendTo($svg);
            };

            var mouseup = function(evt) {
                if (!scope.enabled) {
                    return false;
                }

                if (evt.button === 2) {
                    if (evt.target.tagName === 'polygon') {
                        delete_region(evt.target);
                    }
                    return false;
                }

                create_point(evt.offsetX, evt.offsetY);
            };

            var watch_keypress = function () {
                $(window).on('keypress', keypress)
            };

            var unwatch_keypress = function () {
                $(window).off('keypress')
            };

            var keypress = function(evt) {
                if (evt.key === "Enter") {
                    deactivate_region();
                }
            };

            $svg.on('mouseup', mouseup);

            // a slight hack to capture key presses in the SVG element
            $svg.on('mouseenter', watch_keypress);
            $svg.on('mouseleave', unwatch_keypress);

        },
        templateUrl: 'static/js/drw-poly.html'
    }
}]);
