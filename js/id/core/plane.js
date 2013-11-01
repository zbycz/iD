/*
  Plane provides loading logic and memory management for OSM data.

  It divides the spherical mercator surface into data tiles at zoom levels
  14-16 such that the density of any given tile does not exceed a certain
  threshold.

  Eventually it will support purging data for tiles that are off-screen.
 */
iD.Plane = function(connection) {
    var root = iD.Quadtree(connection)(0, 0, 0);
    var plane = {};

    // Ensure that data tiles covering the given extent are loaded. Plane
    // will determine the appropriate tile zoom levels to use.
    plane.load = function(extent) {
        root.abort(extent);
        return root.load(extent, 16);
    };

    // Return the maximum zoom level of the tiles covering the given extent;
    // i.e. the _minimum_ zoom level at which data will be displayed.
    plane.zoom = function(extent) {
        return root.zoom(extent);
    };

    return plane;
};
