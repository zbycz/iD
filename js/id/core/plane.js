/*
  Plane provides loading logic and memory management for OSM data.

  It divides the spherical mercator surface into data tiles at zoom levels
  14-16 such that the density of any given tile does not exceed a certain
  threshold.

  Eventually it will support purging data for tiles that are off-screen.
 */
iD.Plane = function(connection) {
    var SM = new SphericalMercator();

    function Node(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    Node.prototype.split = function() {
        if (this.nw) return;
        var x2 = this.x * 2,
            y2 = this.y * 2,
            z1 = this.z + 1;
        this.nw = new Node(x2,     y2,     z1);
        this.ne = new Node(x2 + 1, y2,     z1);
        this.sw = new Node(x2,     y2 + 1, z1);
        this.se = new Node(x2 + 1, y2 + 1, z1);
    };

    Node.prototype.intersects = function(extent) {
        extent = SM.xyz([extent[0][0], extent[0][1], extent[1][0], extent[1][1]], this.z);
        return extent.minX <= this.x &&
               extent.maxX >= this.x &&
               extent.minY <= this.y &&
               extent.maxY >= this.y;
    };

    Node.prototype.extent = function() {
        var bbox = SM.bbox(this.x, this.y, this.z);
        return iD.geo.Extent([bbox[0], bbox[1]], [bbox[2], bbox[3]]);
    };

    Node.prototype.load = function(extent) {
        if (!this.intersects(extent))
            return this.abort();

        if (this.data)
            return;

        if (this.z !== 16) {
            this.split();
            this.nw.load(extent);
            this.ne.load(extent);
            this.sw.load(extent);
            this.se.load(extent);

        } else if (!this.request) {
            this.request = connection.loadExtent(this.extent(), this.loaded.bind(this));
        }
    };

    Node.prototype.loaded = function(err, data) {
        this.data = data;
        this.request = null;
    };

    Node.prototype.abort = function() {
        if (this.request)
            this.request.abort();
        if (!this.nw)
            return;
        this.nw.abort();
        this.ne.abort();
        this.sw.abort();
        this.se.abort();
    };

    Node.prototype.zoom = function(extent) {
        return 16;
    };

    var root = new Node(0, 0, 0);
    var plane = {};

    // Ensure that data tiles covering the given extent are loaded. Plane
    // will determine the appropriate tile zoom levels to use.
    plane.load = function(extent) {
        return root.load(extent);
    };

    // Return the maximum zoom level of the tiles covering the given extent;
    // i.e. the _minimum_ zoom level at which data will be displayed.
    plane.zoom = function(extent) {
        return root.zoom(extent);
    };

    plane.abort = function() {
        return root.abort();
    };

    return plane;
};
