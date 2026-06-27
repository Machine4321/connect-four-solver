const boardEl = document.getElementById('board');
const dropZones = document.querySelectorAll('.drop-zone');
const statusText = document.getElementById('status-text');
const turnIndicator = document.getElementById('turn-indicator');
const btnCalculate = document.getElementById('btn-calculate');
const btnUndo = document.getElementById('btn-undo');
const btnClear = document.getElementById('btn-clear');

let gameState = {
    board: new Board(),
    moves: [],
    currentPlayer: 1, // 1 for Red, 2 for Yellow
    gameOver: false,
    apiScores: null
};

function initBoard() {
    boardEl.innerHTML = '';
    for (let row = 5; row >= 0; row--) {
        for (let col = 0; col < 7; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `cell-${col}-${row}`;
            boardEl.appendChild(cell);
        }
    }
    updateStatus();
}

function clearBoard() {
    gameState.board = new Board();
    gameState.moves = [];
    gameState.currentPlayer = 1;
    gameState.gameOver = false;
    gameState.apiScores = null;
    
    document.querySelectorAll('.piece').forEach(p => p.remove());
    document.querySelectorAll('.cell.win').forEach(c => c.classList.remove('win'));
    clearScoreBadges();
    
    updateStatus();
}

function undoMove() {
    if (gameState.moves.length === 0) return;
    
    gameState.moves.pop();
    
    // Rebuild board state
    gameState.board = new Board();
    gameState.moves.forEach(col => gameState.board.play(col));
    
    gameState.currentPlayer = gameState.moves.length % 2 === 0 ? 1 : 2;
    gameState.gameOver = false;
    gameState.apiScores = null;
    clearScoreBadges();
    
    // Remove pieces from DOM
    document.querySelectorAll('.piece').forEach(p => p.remove());
    
    // Re-add pieces based on moves
    let tempPlayer = 1;
    let colHeights = [0,0,0,0,0,0,0];
    
    for (let col of gameState.moves) {
        let row = colHeights[col]++;
        const cell = document.getElementById(`cell-${col}-${row}`);
        const piece = document.createElement('div');
        piece.className = `piece ${tempPlayer === 1 ? 'red' : 'yellow'}`;
        // Set transform to 0 so it doesn't animate
        piece.style.transform = 'translateY(0)';
        piece.style.animation = 'none';
        cell.appendChild(piece);
        tempPlayer = tempPlayer === 1 ? 2 : 1;
    }
    
    updateStatus();
}

function updateStatus() {
    document.getElementById('drop-zones').setAttribute('data-turn', gameState.currentPlayer);
    turnIndicator.className = 'player-indicator ' + (gameState.currentPlayer === 1 ? 'red' : 'yellow');
    
    if (gameState.gameOver) {
        statusText.textContent = "Game Over";
        btnCalculate.textContent = "Game Over";
        btnCalculate.disabled = true;
    } else {
        const playerColor = gameState.currentPlayer === 1 ? "Red" : "Yellow";
        statusText.textContent = playerColor + " to play";
        btnCalculate.textContent = "Calculate Optimal Move for " + playerColor;
        btnCalculate.disabled = false;
    }
}

function clearScoreBadges() {
    document.querySelectorAll('.score-badge').forEach(b => {
        b.classList.remove('visible');
        b.textContent = '';
    });
    document.querySelectorAll('.drop-zone').forEach(z => {
        z.classList.remove('suggested-move');
    });
    document.querySelectorAll('.cell').forEach(c => {
        c.classList.remove('suggested-target');
    });
}

function makeMove(col) {
    if (gameState.gameOver || !gameState.board.canPlay(col)) return;
    
    clearScoreBadges();
    gameState.apiScores = null;
    
    let row = 0;
    for (let r = 0; r < 6; r++) {
        if (!document.querySelector(`#cell-${col}-${r} .piece`)) {
            row = r;
            break;
        }
    }
    
    const cell = document.getElementById(`cell-${col}-${row}`);
    const piece = document.createElement('div');
    piece.className = `piece drop ${gameState.currentPlayer === 1 ? 'red' : 'yellow'}`;
    cell.appendChild(piece);
    
    if (gameState.board.isWinningMove(col)) {
        gameState.board.play(col);
        gameState.moves.push(col);
        gameState.gameOver = true;
        statusText.textContent = (gameState.currentPlayer === 1 ? "Red" : "Yellow") + " Wins!";
        return;
    }
    
    gameState.board.play(col);
    gameState.moves.push(col);
    
    if (gameState.moves.length === 42) {
        gameState.gameOver = true;
        statusText.textContent = "Draw!";
        return;
    }
    
    gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
    updateStatus();
}

async function calculateOptimalMove() {
    if (gameState.gameOver) return;
    
    btnCalculate.textContent = "Calculating...";
    btnCalculate.disabled = true;
    
    const posStr = gameState.moves.map(m => m + 1).join('');
    try {
        const res = await fetch('https://connect4.gamesolver.org/solve?pos=' + posStr);
        const data = await res.json();
        gameState.apiScores = data.score;
        updateScoreBadges();
    } catch (e) {
        console.error('API Fetch failed', e);
        alert('Failed to connect to the solver API.');
    } finally {
        const playerColor = gameState.currentPlayer === 1 ? "Red" : "Yellow";
        btnCalculate.textContent = "Calculate Optimal Move for " + playerColor;
        btnCalculate.disabled = false;
    }
}

function updateScoreBadges() {
    const scores = gameState.apiScores;
    if (!scores) return;
    
    let bestScore = -1000;
    for (let i = 0; i < 7; i++) {
        if (scores[i] !== 100 && scores[i] > bestScore) {
            bestScore = scores[i];
        }
    }
    
    dropZones.forEach((zone, col) => {
        const badge = zone.querySelector('.score-badge');
        const score = scores[col];
        if (score === 100) {
            badge.classList.remove('visible');
            return;
        }
        
        badge.classList.add('visible');
        badge.classList.remove('positive', 'negative', 'zero');
        
        // Emphasize the best move
        if (score === bestScore) {
            zone.classList.add('suggested-move');
            
            // Find the specific cell to highlight
            let targetRow = -1;
            for (let r = 0; r < 6; r++) {
                if (!document.querySelector(`#cell-${col}-${r} .piece`)) {
                    targetRow = r;
                    break;
                }
            }
            if (targetRow !== -1) {
                document.getElementById(`cell-${col}-${targetRow}`).classList.add('suggested-target');
            }
            
            badge.style.transform = 'translateX(-50%) scale(1.3)';
            badge.style.boxShadow = '0 0 10px rgba(255,255,255,0.5)';
            badge.style.zIndex = '100';
            badge.innerHTML = '⬇ ' + (score > 0 ? '+' + score : score);
            if (score === 0) badge.innerHTML = '⬇ 0';
        } else {
            zone.classList.remove('suggested-move');
            
            // Remove target highlight from this column if any
            for (let r = 0; r < 6; r++) {
                document.getElementById(`cell-${col}-${r}`).classList.remove('suggested-target');
            }
            
            badge.style.transform = 'translateX(-50%) scale(1)';
            badge.style.boxShadow = 'none';
            badge.style.zIndex = '1';
            
            if (score > 0) {
                badge.textContent = '+' + score;
            } else if (score < 0) {
                badge.textContent = score;
            } else {
                badge.textContent = '0';
            }
        }
        
        if (score > 0) {
            badge.classList.add('positive');
        } else if (score < 0) {
            badge.classList.add('negative');
        } else {
            badge.classList.add('zero');
        }
    });
}

// Event Listeners
dropZones.forEach(zone => {
    zone.addEventListener('click', () => {
        if (gameState.gameOver) return;
        const col = parseInt(zone.getAttribute('data-col'));
        if (gameState.board.canPlay(col)) {
            makeMove(col);
        }
    });
});

btnCalculate.addEventListener('click', calculateOptimalMove);
btnUndo.addEventListener('click', undoMove);
btnClear.addEventListener('click', clearBoard);

// Remove the modal code completely since we just show text in status
const modal = document.getElementById('winner-modal');
if(modal) modal.remove();

// Initialize
initBoard();
clearBoard();
