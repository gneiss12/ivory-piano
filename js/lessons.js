// Curriculum: units -> lessons -> steps (info | find | drill | song)
const Lessons = (() => {
  const R = (ms, fs = []) => ms.map((m, i) => ({ m, h: 'R', f: fs[i] }));
  const L = (ms, fs = []) => ms.map((m, i) => ({ m, h: 'L', f: fs[i] }));

  const units = [
    { id: 'u1', title: 'Finding Your Way', color: '#7c5cff', emoji: '🧭', lessons: [
      { id: 'l1', title: 'The Keyboard Map', desc: 'Black-key groups & finding C', steps: [
        { type: 'info', title: 'Welcome to the piano!', html: '<p>Every piano repeats the same pattern. The secret to finding any note is the <b>black keys</b>: they come in <b class="c-r">groups of two</b> and <b class="c-l">groups of three</b>.</p><p>Look at the keyboard below — can you see the pattern repeating?</p>',
          kb: { lo: 48, hi: 71, marks: [...R([49, 51, 61, 63]), ...L([54, 56, 58, 66, 68, 70])] } },
        { type: 'find', prompt: 'Play any black key in a group of <b>two</b>', pcs: [1, 3], reps: 3, kb: { lo: 48, hi: 71 } },
        { type: 'find', prompt: 'Now any black key in a group of <b>three</b>', pcs: [6, 8, 10], reps: 3, kb: { lo: 48, hi: 71 } },
        { type: 'info', title: 'Meet C', html: '<p><b>C</b> is the white key just to the <b>left of the two black keys</b>. There\'s a C in every octave.</p><p>The C nearest the middle of the piano is <b>Middle C</b> — your home base. Find it on your keyboard now (usually right in front of the brand name).</p>',
          kb: { lo: 48, hi: 72, marks: [{ m: 48, h: 'L' }, { m: 60, h: 'R', f: '★' }, { m: 72, h: 'L' }] } },
        { type: 'find', prompt: 'Play any <b>C</b> — try different ones!', pcs: [0], reps: 4, kb: { lo: 36, hi: 84 } },
        { type: 'find', prompt: 'Now find <b>Middle C</b>', notes: [60], reps: 2, kb: { lo: 36, hi: 84 } },
        { type: 'info', title: 'D and E', html: '<p><b>D</b> lives <b>between</b> the two black keys. <b>E</b> is just to the <b>right</b> of them.</p><p>C – D – E: the three white keys around the two black keys.</p>',
          kb: { lo: 48, hi: 71, marks: R([60, 62, 64], ['C', 'D', 'E']) } },
        { type: 'find', prompt: 'Play any <b>D</b>', pcs: [2], reps: 2, kb: { lo: 48, hi: 71 } },
        { type: 'find', prompt: 'Play any <b>E</b>', pcs: [4], reps: 2, kb: { lo: 48, hi: 71 } }
      ] },
      { id: 'l2', title: 'Finger Numbers', desc: 'Fingers 1–5 and C position', steps: [
        { type: 'info', title: 'Your fingers have numbers', html: '<p>Piano music labels each finger with a number — the same on both hands:</p><div class="finger-row"><span><b>1</b>thumb</span><span><b>2</b>pointer</span><span><b>3</b>middle</span><span><b>4</b>ring</span><span><b>5</b>pinky</span></div><p>Wiggle each finger while saying its number. Silly, but it works!</p>' },
        { type: 'info', title: 'Right-hand C position', html: '<p>Put your right <b>thumb (1) on Middle C</b>. Let each finger rest on the next white key: <b>C D E F G</b> = fingers <b>1 2 3 4 5</b>.</p><p>Keep fingers curved, like holding a small ball, and play on the fingertips. 🫧</p>',
          kb: { lo: 55, hi: 72, marks: R([60, 62, 64, 65, 67], [1, 2, 3, 4, 5]) } },
        { type: 'song', song: 'cwarm', hands: 'R' },
        { type: 'find', targets: [
          { prompt: 'Play <b>E</b> with finger 3', notes: [64] }, { prompt: 'Play <b>G</b> with finger 5', notes: [67] },
          { prompt: 'Play <b>D</b> with finger 2', notes: [62] }, { prompt: 'Play <b>F</b> with finger 4', notes: [65] },
          { prompt: 'Play <b>C</b> with your thumb', notes: [60] }], kb: { lo: 55, hi: 72 } }
      ] },
      { id: 'l3', title: 'Your First Song', desc: 'Hot Cross Buns — just 3 notes', steps: [
        { type: 'info', title: 'Wait mode', html: '<p>Time for real music! The <b>glowing key</b> shows what to play next, with the finger number on it.</p><p>In <b>Wait mode</b> the music waits for you — there\'s no rush. Slow and steady wins.</p><p>Tip: tap <b>Listen</b> first to hear how it should sound.</p>' },
        { type: 'song', song: 'hcb', hands: 'R' }
      ] },
      { id: 'l4', title: 'Mary Had a Little Lamb', desc: 'Adding G with your pinky', steps: [
        { type: 'info', title: 'Reaching G', html: '<p>This song adds <b>G</b>, played by your pinky (5). Keep your hand in C position — every finger already sits on its key, so your hand never has to move.</p>',
          kb: { lo: 55, hi: 72, marks: R([60, 62, 64, 67], [1, 2, 3, 5]) } },
        { type: 'song', song: 'mary', hands: 'R' }
      ] }
    ] },
    { id: 'u2', title: 'Reading Music', color: '#ff7a59', emoji: '🎼', lessons: [
      { id: 'l5', title: 'The Treble Staff', desc: 'Where notes live on paper', steps: [
        { type: 'info', title: 'The staff', html: '<p>Music is written on 5 lines called the <b>staff</b>. Notes sit <b>on lines</b> or <b>in spaces</b> — the higher a note sits, the higher it sounds.</p><p>The curly <b>treble clef</b> marks the top staff, played by your right hand.</p>',
          staff: { rh: 'C4q D4q E4q F4q G4q' } },
        { type: 'info', title: 'Middle C on paper', html: '<p>Middle C sits on its own little line <b>below</b> the staff. D hangs just under the bottom line, and E sits <b>on</b> the bottom line.</p><p>See the pattern? <b>line, space, line, space…</b> Every step up the keyboard is one step up the staff.</p>',
          staff: { rh: 'C4h D4h E4h F4h G4w' } },
        { type: 'drill', pool: [60, 62, 64], rounds: 8, clef: 't' },
        { type: 'drill', pool: [60, 62, 64, 65, 67], rounds: 10, clef: 't' },
        { type: 'song', song: 'auclair', hands: 'R' }
      ] },
      { id: 'l6', title: 'Counting the Beat', desc: 'Quarter, half & whole notes', steps: [
        { type: 'info', title: 'How long to hold', html: '<p>A note\'s shape tells you how long to hold it:</p><ul><li><b>Quarter note</b> — filled, with a stem: <b>1 beat</b></li><li><b>Half note</b> — hollow, with a stem: <b>2 beats</b></li><li><b>Whole note</b> — hollow, no stem: <b>4 beats</b></li></ul><p><b>Bar lines</b> split music into <b>measures</b> of 4 beats. Count out loud: “1, 2, 3, 4”.</p>',
          staff: { rh: 'C4q C4q C4q C4q | E4h E4h | G4w' } },
        { type: 'info', title: 'Play mode', html: '<p>Now try <b>Play mode</b>: the music keeps moving at a steady beat, and you play each note <b>as it reaches the glowing line</b>.</p><p>You\'ll hear clicks to count you in. If you miss a note, keep going — real musicians never stop!</p>' },
        { type: 'song', song: 'mary', hands: 'R', mode: 'play', tempo: 0.7 }
      ] },
      { id: 'l7', title: 'Ode to Joy', desc: 'Beethoven\'s famous melody', steps: [
        { type: 'info', title: 'Your first Beethoven!', html: '<p>Beethoven wrote this melody in 1824 for his 9th Symphony — and it uses only your five C-position fingers.</p><p>Watch for the <b>dotted quarter note</b>: a dot adds half again, so it lasts <b>1½ beats</b>, followed by a quick eighth note.</p>' },
        { type: 'song', song: 'ode', hands: 'R' },
        { type: 'song', song: 'ode', hands: 'R', mode: 'play', tempo: 0.75 }
      ] },
      { id: 'l8', title: 'Stretch to A', desc: 'Twinkle, Twinkle', steps: [
        { type: 'info', title: 'One step beyond', html: '<p><b>A</b> is the white key just past G. Reach your pinky up one key to grab it, then come back.</p><p>On the staff, A sits in the second space up.</p>',
          staff: { rh: 'G4q A4q G4h' }, kb: { lo: 55, hi: 72, marks: R([60, 67, 69], [1, 5, 5]) } },
        { type: 'drill', pool: [60, 62, 64, 65, 67, 69], rounds: 10, clef: 't' },
        { type: 'song', song: 'twinkle', hands: 'R' }
      ] }
    ] },
    { id: 'u3', title: 'The Left Hand', color: '#10b981', emoji: '🤚', lessons: [
      { id: 'l9', title: 'The Bass Staff', desc: 'Your left hand\'s home', steps: [
        { type: 'info', title: 'Bass clef', html: '<p>Your left hand reads the lower staff, marked by the <b>bass clef</b>. Its two dots surround the line for <b>F</b>.</p><p><b>Left-hand C position:</b> pinky (5) on the C <b>below</b> Middle C. So <b>C D E F G</b> = fingers <b>5 4 3 2 1</b> — your thumb ends up on G.</p>',
          staff: { lh: 'C3q D3q E3q F3q G3q' }, kb: { lo: 43, hi: 64, marks: L([48, 50, 52, 53, 55], [5, 4, 3, 2, 1]) } },
        { type: 'drill', pool: [48, 50, 52, 53, 55], rounds: 10, clef: 'b' },
        { type: 'song', song: 'lhwarm', hands: 'L' }
      ] },
      { id: 'l10', title: 'Left-Hand Tunes', desc: 'Melody in the bass', steps: [
        { type: 'info', title: 'Same song, other hand', html: '<p>Remember Hot Cross Buns? Let\'s play it with your <b>left hand</b> — notice the fingers are now 3, 4, 5.</p><p>Then a bonus round: <b>Frère Jacques</b> with your right hand, which dips down to a low G at the end.</p>' },
        { type: 'song', song: 'hcblh', hands: 'L' },
        { type: 'song', song: 'frere', hands: 'R' }
      ] },
      { id: 'l11', title: 'Your First Chords', desc: 'C and G7', steps: [
        { type: 'info', title: 'Chords!', html: '<p>A <b>chord</b> is several notes played together. The <b>C chord</b> is <b>C – E – G</b>: left-hand fingers <b>5, 3, 1</b>. Press all three at once.</p><p>Chords are how you make a melody sound like a full song.</p>',
          kb: { lo: 43, hi: 64, marks: L([48, 52, 55], [5, 3, 1]) } },
        { type: 'find', prompt: 'Play the <b>C chord</b> (C – E – G)', notes: [48, 52, 55], h: 'L', fingers: [5, 3, 1], reps: 3, kb: { lo: 43, hi: 64 } },
        { type: 'info', title: 'The G7 chord', html: '<p>From the C chord: move your pinky <b>down one key to B</b>, put finger 2 on <b>F</b>, and keep your thumb on <b>G</b>. That\'s <b>G7</b>.</p><p>Listen to how G7 sounds like it wants to go home to C!</p>',
          kb: { lo: 43, hi: 64, marks: L([47, 53, 55], [5, 2, 1]) } },
        { type: 'find', prompt: 'Play the <b>G7 chord</b> (B – F – G)', notes: [47, 53, 55], h: 'L', fingers: [5, 2, 1], reps: 3, kb: { lo: 43, hi: 64 } },
        { type: 'song', song: 'chords1', hands: 'L' }
      ] },
      { id: 'l12', title: 'The F Chord', desc: 'Three chords = hundreds of songs', steps: [
        { type: 'info', title: 'The F chord', html: '<p>Keep your pinky on C, move finger 2 to <b>F</b>, and stretch your thumb up to <b>A</b>: <b>C – F – A</b>.</p><p>With <b>C, F and G7</b> you can accompany hundreds of songs!</p>',
          kb: { lo: 43, hi: 64, marks: L([48, 53, 57], [5, 2, 1]) } },
        { type: 'find', prompt: 'Play the <b>F chord</b> (C – F – A)', notes: [48, 53, 57], h: 'L', fingers: [5, 2, 1], reps: 3, kb: { lo: 43, hi: 64 } },
        { type: 'song', song: 'chords2', hands: 'L' }
      ] }
    ] },
    { id: 'u4', title: 'Hands Together', color: '#3b82f6', emoji: '🙌', lessons: [
      { id: 'l13', title: 'Ode to Joy, Both Hands', desc: 'Melody + chords', steps: [
        { type: 'info', title: 'Two hands, one song', html: '<p>The pro secret: learn each hand <b>separately</b>, then put them together <b>slowly</b>.</p><p>First the left-hand chords alone, then both. In Wait mode the music moves on once <b>both hands</b> have played.</p>' },
        { type: 'song', song: 'ode', hands: 'L' },
        { type: 'song', song: 'ode', hands: 'B' }
      ] },
      { id: 'l14', title: 'Jingle Bells', desc: 'A holiday favorite', steps: [
        { type: 'song', song: 'jingle', hands: 'R' },
        { type: 'song', song: 'jingle', hands: 'B' }
      ] },
      { id: 'l15', title: 'Waltz Time', desc: 'Counting in 3 — Happy Birthday', steps: [
        { type: 'info', title: 'Counting in 3', html: '<p>Some music counts in <b>3</b>: “1, 2, 3 — 1, 2, 3”. The <b>3/4</b> at the start tells you so. A <b>dotted half note</b> lasts all 3 beats.</p><p>Happy Birthday starts with a <b>pickup</b>: a couple of quick notes before the first full measure.</p>' },
        { type: 'song', song: 'bday', hands: 'R' },
        { type: 'song', song: 'bday', hands: 'B' }
      ] },
      { id: 'l16', title: 'Amazing Grace', desc: 'A beautiful slow song in 3', steps: [
        { type: 'info', title: 'Moving your hand', html: '<p>This melody sits higher, so your right hand starts in <b>G position</b> (thumb on the G above Middle C) and briefly reaches up to a high G in the middle.</p><p>Play it slowly and let the long notes ring.</p>' },
        { type: 'song', song: 'amazing', hands: 'R' },
        { type: 'song', song: 'amazing', hands: 'B' }
      ] },
      { id: 'l17', title: 'When the Saints', desc: 'Upbeat and fun', steps: [
        { type: 'song', song: 'saints', hands: 'R' },
        { type: 'song', song: 'saints', hands: 'B' },
        { type: 'song', song: 'saints', hands: 'B', mode: 'play', tempo: 0.7 }
      ] }
    ] },
    { id: 'u6', title: 'Play Pop', color: '#8b5cf6', emoji: '🎤', lessons: [
      { id: 'p1', title: 'The Pop Chord Secret', desc: 'Four chords, thousands of songs', steps: [
        { type: 'info', title: 'Two new chords', html: '<p>You know <b>C</b> and <b>F</b>. Two more and you can play along with a huge amount of pop music:</p><ul><li><b>G</b> = B – D – G (left-hand fingers 5, 3, 1)</li><li><b>A minor (Am)</b> = A – C – E (fingers 5, 3, 1)</li></ul><p>“Minor” chords sound a little sad or dreamy. Listen for it!</p>',
          kb: { lo: 43, hi: 64, marks: L([45, 48, 52], [5, 3, 1]) } },
        { type: 'find', prompt: 'Play the <b>G chord</b> (B – D – G)', notes: [47, 50, 55], h: 'L', fingers: [5, 3, 1], reps: 2, kb: { lo: 43, hi: 64 } },
        { type: 'find', prompt: 'Play the <b>A minor chord</b> (A – C – E)', notes: [45, 48, 52], h: 'L', fingers: [5, 3, 1], reps: 3, kb: { lo: 43, hi: 64 } },
        { type: 'info', title: 'The four chords', html: '<p>Here\'s the secret: <b>C → G → Am → F</b>, played over and over, is the backbone of songs like <i>Let It Be</i>, <i>Don\'t Stop Believin\'</i>, <i>I\'m Yours</i> and <i>Someone Like You</i> (in their own keys).</p><p>Play each chord for 4 slow counts. Notice how your hand barely moves!</p>' },
        { type: 'song', song: 'fourchords', hands: 'L' }
      ] },
      { id: 'p2', title: 'Pop Groove', desc: 'Chords in a rhythm, both hands', steps: [
        { type: 'info', title: 'Make it groove', html: '<p>Now the <b>right hand plays the chords</b> in a rhythm — long, short, short: “<b>1</b> – 2, <b>3</b>, <b>4</b>” — while the <b>left hand plays one bass note</b>.</p><p>The right-hand shapes stay close to Middle C, so only one or two fingers move between chords.</p>' },
        { type: 'song', song: 'popgroove', hands: 'R' },
        { type: 'song', song: 'popgroove', hands: 'B' },
        { type: 'song', song: 'popgroove', hands: 'B', mode: 'play', tempo: 0.8 }
      ] },
      { id: 'p3', title: 'Play Along with Any Song', desc: 'Ballad style + using chord charts', steps: [
        { type: 'info', title: 'Ballad style', html: '<p>For slow songs, play the chord <b>one note at a time</b> (a “broken chord”). Same four chords, in a different order: <b>Am → F → C → G</b>. Sound familiar?</p>' },
        { type: 'song', song: 'popballad', hands: 'R' },
        { type: 'song', song: 'popballad', hands: 'B' },
        { type: 'info', title: 'Play along with real songs', html: '<p>Search online for “<i>song name</i> <b>easy piano chords</b>”. You\'ll get the lyrics with chord names above them.</p><p>Play each chord when it appears — with the groove or ballad pattern — and sing or play along with the recording. Stick to songs that use <b>C, G, Am and F</b> for now.</p><p>Want the actual melody? Get a MIDI file of the song (easy piano versions are sold on sheet-music sites) and add it under <b>Songs → Add your own song</b>.</p>' }
      ] }
    ] },
    { id: 'u5', title: 'Real Repertoire', color: '#e11d48', emoji: '🎹', lessons: [
      { id: 'l18', title: 'Sharps & Flats', desc: 'Naming the black keys', steps: [
        { type: 'info', title: 'Black keys have names', html: '<p>A <b>sharp ♯</b> means play the key just to the <b>right</b>. A <b>flat ♭</b> means the key just to the <b>left</b>.</p><p>So <b>F♯</b> is the black key right after F. (The same key can also be called G♭.)</p>',
          staff: { rh: 'F4h F#4h G4w' }, kb: { lo: 55, hi: 72, marks: R([65, 66, 67], ['F', '♯', 'G']) } },
        { type: 'drill', pool: [60, 62, 64, 65, 66, 67, 69, 71], rounds: 12, clef: 't' }
      ] },
      { id: 'l19', title: 'Pachelbel\'s Canon', desc: 'The wedding classic', steps: [
        { type: 'info', title: 'Eight magic bass notes', html: '<p>Pachelbel\'s Canon repeats the same <b>8 bass notes</b> over and over while the melody changes on top. Learn the left hand first — it never changes!</p><p>This easy version is moved into the key of C.</p>' },
        { type: 'song', song: 'canon', hands: 'L' },
        { type: 'song', song: 'canon', hands: 'B' }
      ] },
      { id: 'l20', title: 'Minuet in G', desc: 'From Anna Magdalena Bach\'s notebook', steps: [
        { type: 'info', title: 'A gift of music', html: '<p>This minuet comes from a notebook of pieces that J.S. Bach gave to his wife, <b>Anna Magdalena</b>, so she could learn to play. 💛</p><p>Right thumb on <b>G</b>. Watch for <b>F♯</b> — the black key just right of F.</p>' },
        { type: 'song', song: 'minuet', hands: 'R' },
        { type: 'song', song: 'minuet', hands: 'B' }
      ] },
      { id: 'l21', title: 'Für Elise', desc: 'Beethoven\'s most famous tune', steps: [
        { type: 'info', title: 'The famous opening', html: '<p>Für Elise rocks back and forth between <b>E</b> and <b>D♯</b>. Keep your wrist loose and fingers light.</p><p>The hands take turns: left hand plays a little rolling pattern, then right hand answers.</p>' },
        { type: 'song', song: 'furelise', hands: 'R' },
        { type: 'song', song: 'furelise', hands: 'B' }
      ] }
    ] }
  ];
  const flat = [];
  units.forEach(u => u.lessons.forEach(l => { l.unit = u; flat.push(l); }));
  const byId = Object.fromEntries(flat.map(l => [l.id, l]));
  return { units, flat, byId };
})();
