// @@logic-start — T0 stub. C1 replaces timing, the TP program, IK and collisions.
// Keep BOARD, boardHoles() and HOLES: the Solitaire mesh reads them.
// Board frame: origin at the board centre, +x right, +y back. UF1 origin is the front-left corner.
// A is the left triangle (base outward), B the right triangle mirrored. Rows 4-3-2-1. [E]

const BOARD = {
  x: -0.10, y: -0.08,
  w: 0.260, d: 0.160, h: 0.020, topZ: 0.020,
  holeR: 0.0105, holeD: 0.012,
  pitch: 0.034, row: 0.0294, tri: 0.065,
  cylR: 0.010, cylH: 0.032, chamfer: 0.001,
};

function boardHoles() {
  const rows = [4, 3, 2, 1];
  const holes = [];
  const count = { A: 0, B: 0 };
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? "A" : "B";
    const cx = sign * BOARD.tri;
    rows.forEach((n, r) => {
      const x = cx - sign * (r - 1.5) * BOARD.row;
      for (let c = 0; c < n; c++) {
        const y = (c - (n - 1) / 2) * BOARD.pitch;
        count[side] += 1;
        holes.push({
          id: side + count[side], side, i: count[side], row: r, col: c,
          lx: x, ly: y,
          x: BOARD.x + x, y: BOARD.y + y, z: BOARD.topZ,
          ux: x + BOARD.w / 2, uy: y + BOARD.d / 2,
          cz: BOARD.topZ - BOARD.holeD / 2 + BOARD.cylH / 2,
        });
      }
    });
  }
  return holes;
}

const HOLES = boardHoles();
const DURATION = 4;
const segs = {
  robot: [{ t0: 0, t1: DURATION, label: "HOME", cmd: "J PR[1:HOME] 100% FINE", line: 6 }],
  gripper: [{ t0: 0, t1: DURATION, label: "OPEN", cmd: "CALL GRIP_OPEN", line: 7 }],
  vision: [{ t0: 0, t1: DURATION, label: "IDLE", cmd: "", line: 0 }],
  io: [{ t0: 0, t1: DURATION, label: "DOOR_OK", cmd: "DI[1:DOOR_OK]=ON", line: 5 }],
};
const TP = [
  "1:  UFRAME_NUM=1 ;",
  "2:  UTOOL_NUM=1 ;",
  "3:  PAYLOAD[1] ;",
  "4:  DO[11:BUSY]=ON ;",
  "5:  WAIT DI[1:DOOR_OK]=ON ;",
  "6:J PR[1:HOME] 100% FINE ;",
];
const parts = HOLES.filter((h) => h.side === "A").map((h) => ({
  id: h.id, from: h.id, to: "B" + h.i,
  track: [{ t: 0, p: [h.x, h.y, h.cz] }, { t: DURATION, p: [h.x, h.y, h.cz] }],
}));
const S = { t: [0], q: [[0, 0, 0, 0, -90, 0]], tcp: [[0.2, 0.3, 0.4]] };
const minClear = { m: 0.051, at: 0 };

function robotPose(t) {
  return { q: [0, 0, 0, 0, -90, 0], grip: 0, seg: segs.robot[0], tcp: [0.2, 0.3, 0.4], t };
}
function ioAt() {
  return {
    DI: { "1:DOOR_OK": 1 },
    DO: { "11:BUSY": 0, "12:CYCLE_DONE": 0 },
    RI: { "1:CLOSED": 0, "2:OPENED": 1 },
    RO: { "1:CLOSE": 0, "2:OPEN": 1 },
  };
}
function lineAt() { return 6; }
function fk(q) {
  return { R: [[0, 0, 1], [0, -1, 0], [1, 0, 0]], p: [360, 0, 280], q };
}
function ik(pose, qPrev) {
  return { q: qPrev ? qPrev.slice() : [0, 0, 0, 0, -90, 0], cfg: "N U T" };
}
// @@logic-end
