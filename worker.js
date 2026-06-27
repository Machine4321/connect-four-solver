importScripts('engine.js');

self.onmessage = function(e) {
    const { moves, depth } = e.data;
    
    // Reconstruct board from moves
    let board = new Board();
    for (let col of moves) {
        board.play(col);
    }
    
    // Calculate best move
    let result = getBestMove(board, depth);
    
    // Send result back
    self.postMessage(result);
};
