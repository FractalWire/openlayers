#define MAX_NUM_VERTICES 5
precision highp int;
precision highp float;
varying vec2 v_texCoord;
varying float v_size;
varying float v_iscircle;
varying vec4 v_hitColor;

vec2 poly[MAX_NUM_VERTICES];
float segLen[MAX_NUM_VERTICES];
float vPerimeter[MAX_NUM_VERTICES];
const int n = 5;

float strokefactor = 3.;

vec4 outsidecolor = vec4(0.);

float isLeft(vec2 p, vec2 v0, vec2 v1) {
    return ((v1.x - v0.x) * (p.y - v0.y)
            - (p.x - v0.x) * (v1.y - v0.y));
}

// isInPoly(): winding number test for a point in a polygon
//      attrs - p: a point,
//              v: the polygon vertices,
//              n: number of vertices of the polygon
//      return: true if p is in the polygon
bool isInPoly(vec2 p, vec2 v[MAX_NUM_VERTICES], const int n){
    int wn = 0;

    for (int i=0; i<MAX_NUM_VERTICES; i++){
        if (i>=n-1) break;
        if (v[i].y <= p.y){
            if (v[i+1].y > p.y) {
                if (isLeft(p, v[i], v[i+1]) > 0.0){
                    ++wn;
                }
            }
        }
        else {
            if(v[i+1].y <= p.y){
                if (isLeft(p,v[i],v[i+1]) < 0.0){
                    --wn;
                }
            }
        }
    }
    return wn != 0;
}

vec4 getCircle(vec2 p, vec4 circlecolor){
    float dist = distance(vec2(0.), p);
    if(dist > 1.){
        return outsidecolor;
    }
    return circlecolor;
}

vec4 getPolygon(vec2 p, vec4 polycolor){

    if (!isInPoly(p, poly, n))
        return outsidecolor;
    return polycolor;
}

void main(void) {
    vec2 texCoord = v_texCoord * 2.0 - vec2(1.0, 1.0);
    vec4 symbolcolor = v_hitColor;

    if (v_iscircle == 1.){
        gl_FragColor = getCircle(texCoord, symbolcolor);
    } else {
        poly[0] = vec2(.0, -.6);
        poly[1] = vec2(-.5, -1.0);
        poly[2] = vec2(.0, 1.0);
        poly[3] = vec2(.5, -1.0);
        poly[4] = vec2(.0, -.6);
        gl_FragColor = getPolygon(texCoord, symbolcolor);
    }
}

