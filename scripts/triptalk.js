(() => {
  const sections = Array.isArray(window.phraseData) ? window.phraseData.filter(Boolean) : [];
  let activeIndex = 0;
  let isPlaying = false;
  let isShuffled = false;
  let globalMode = false;
  let autoEnglish = true;
  let greekAudioSpeed = 100;
  let isHelpOpen = false;
  let suppressNextFlip = false;
  let flipDirection = 'next';
  let cardTransition = 'flip';
  let crossfadeFromImage = '';
  let cardOrder = [];
  let currentCardPosition = -1;
  let activeTimer = null;
  let englishDelayTimer = null;
  let toastTimer = null;
  let isGreekAudioButtonActive = false;
  let continuousMode = false;
  let continuousPlaybackTimer = null;
  let continuousPlaybackToken = 0;
  let currentContinuousPlaybackKind = null;
  let currentContinuousPlaybackFinish = null;
  let continuousPauseSeconds = 2;
  let continuousPauseMs = 2000;
  let continuousPauseDurationMs = continuousPauseMs;
  let continuousPauseUsesSetting = false;
  let continuousPauseResolve = null;
  let continuousPauseToken = null;
  let isPronunciationOpen = false;
  let shouldResumeContinuousAfterHelp = false;
  let continuousResumeStep = 'start';

  const els = {
    topbar: document.getElementById('topbar'),
    helpButton: document.getElementById('helpButton'),
    closeHelpButton: document.getElementById('closeHelpButton'),
    closeHelpIconButton: document.getElementById('closeHelpIconButton'),
    pronunciationPanel: document.getElementById('pronunciationPanel'),
    closePronunciationButton: document.getElementById('closePronunciationButton'),
    selectionView: document.getElementById('selectionView'),
    sectionTitle: document.getElementById('sectionTitle'),
    sectionMeta: document.getElementById('sectionMeta'),
    countPill: document.getElementById('countPill'),
    carouselWindow: document.getElementById('carouselWindow'),
    coverTrack: document.getElementById('coverTrack'),
    dotRow: document.getElementById('dotRow'),
    cardControls: document.getElementById('cardControls'),
    cardPrevButton: document.getElementById('cardPrevButton'),
    cardNextButton: document.getElementById('cardNextButton'),
    shuffleControl: document.getElementById('shuffleControl'),
    shuffleToggle: document.getElementById('shuffleToggle'),
    speedValue: document.getElementById('speedValue'),
    continuousIndicator: document.getElementById('continuousIndicator'),
    englishAudio: document.getElementById('englishAudio'),
    greekAudio: document.getElementById('greekAudio'),
    toast: document.getElementById('toast')
  };

  function wrapIndex(index) {
    return (index + sections.length) % sections.length;
  }

  function sectionName(section, index) {
    return section.section || `Section ${index + 1}`;
  }

  function sectionKey(section) {
    return (section?.section || '').toLowerCase();
  }

  function resolveSectionImage(section) {
    const key = sectionKey(section);
    return key ? `images/${key}/section_images/${key}.png` : '';
  }

  function resolveSectionHoverImage(section) {
    const key = sectionKey(section);
    return key ? `images/${key}/section_images/${key}_color.png` : resolveSectionImage(section);
  }

  function resolveRecordCount(section) {
    return section?.records?.length || 0;
  }

  function activeSection() {
    return sections[activeIndex];
  }

  function currentCardIndex() {
    const entry = cardOrder[currentCardPosition];
    return globalMode ? entry?.cardIndex ?? -1 : entry ?? -1;
  }

  function currentCardEntry() {
    if (!globalMode) {
      return { sectionIndex: activeIndex, cardIndex: currentCardIndex() };
    }
    return cardOrder[currentCardPosition] || { sectionIndex: activeIndex, cardIndex: -1 };
  }

  function currentRecord() {
    const entry = currentCardEntry();
    return sections[entry.sectionIndex]?.records?.[entry.cardIndex];
  }

  function currentRecordSection() {
    return sections[currentCardEntry().sectionIndex] || activeSection();
  }

  function stopAudio() {
    clearTimeout(activeTimer);
    clearTimeout(englishDelayTimer);
    activeTimer = null;
    englishDelayTimer = null;
    els.englishAudio.pause();
    els.greekAudio.pause();
    setGreekAudioButtonActive(false);
  }

  function clearContinuousPlaybackStep() {
    currentContinuousPlaybackFinish = null;
    currentContinuousPlaybackKind = null;
  }

  function stopEnglishAudio() {
    clearTimeout(englishDelayTimer);
    englishDelayTimer = null;
    els.englishAudio.pause();
    if (continuousMode && currentContinuousPlaybackKind === 'english' && currentContinuousPlaybackFinish) {
      currentContinuousPlaybackFinish();
      clearContinuousPlaybackStep();
    }
  }

  function clearContinuousPlaybackTimer() {
    clearTimeout(continuousPlaybackTimer);
    continuousPlaybackTimer = null;
  }

  function clearContinuousPauseWait() {
    continuousPauseDurationMs = continuousPauseMs;
    continuousPauseUsesSetting = false;
    continuousPauseResolve = null;
    continuousPauseToken = null;
  }

  function scheduleContinuousPauseTimer() {
    if (!continuousPauseResolve) return;
    clearContinuousPlaybackTimer();
    const token = continuousPauseToken;
    const pauseMs = continuousPauseUsesSetting ? continuousPauseMs : continuousPauseDurationMs;
    continuousPlaybackTimer = window.setTimeout(() => {
      continuousPlaybackTimer = null;
      const resolve = continuousPauseResolve;
      clearContinuousPauseWait();
      if (token !== continuousPlaybackToken) {
        resolve();
        return;
      }
      resolve();
    }, pauseMs);
  }

  function stopContinuousPlayback() {
    clearContinuousPlaybackTimer();
    clearContinuousPauseWait();
    continuousPlaybackToken += 1;
    if (currentContinuousPlaybackFinish) {
      currentContinuousPlaybackFinish();
      clearContinuousPlaybackStep();
    }
    stopAudio();
  }

  function waitForContinuousPause({ durationMs = continuousPauseMs, useSetting = true } = {}) {
    return new Promise((resolve) => {
      continuousPauseDurationMs = durationMs;
      continuousPauseUsesSetting = useSetting;
      continuousPauseResolve = resolve;
      continuousPauseToken = continuousPlaybackToken;
      scheduleContinuousPauseTimer();
    });
  }

  function setContinuousPauseSeconds(value) {
    continuousPauseSeconds = Math.max(0, Math.min(15, value));
    continuousPauseMs = continuousPauseSeconds * 1000;
    showToast(`Continuous Pause: ${continuousPauseSeconds}`);
    if (continuousPauseUsesSetting) scheduleContinuousPauseTimer();
  }

  function adjustContinuousPauseSeconds(delta) {
    setContinuousPauseSeconds(continuousPauseSeconds + delta);
  }

  function playContinuousAudio(kind) {
    const record = currentRecord();
    const audio = kind === 'english' ? els.englishAudio : els.greekAudio;
    const audioInfo = resolveAudioInfo(record, kind);
    if (!audioInfo?.file) return Promise.resolve();

    const token = continuousPlaybackToken;

    return new Promise((resolve) => {
      let settled = false;

      currentContinuousPlaybackKind = kind;

      const cleanup = () => {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        if (kind === 'greek') {
          setGreekAudioButtonActive(false);
        }
      };

      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        if (currentContinuousPlaybackFinish === finish) {
          clearContinuousPlaybackStep();
        }
        resolve();
      };

      currentContinuousPlaybackFinish = finish;

      const onEnded = () => finish();
      const onError = () => finish();

      updateAudioSource(kind, audioInfo.file);
      audio.pause();
      audio.currentTime = 0;

      waitForMetadata(audio)
        .then(() => {
          if (settled || !continuousMode || token !== continuousPlaybackToken) {
            finish();
            return;
          }

          audio.playbackRate = kind === 'greek' ? greekAudioSpeed / 100 : 1;
          audio.currentTime = Math.max(0, audioInfo.startSeconds || 0);
          if (kind === 'greek') {
            setGreekAudioButtonActive(true);
          }

          audio.addEventListener('ended', onEnded, { once: true });
          audio.addEventListener('error', onError, { once: true });
          audio.play().catch(() => {
            finish();
          });
        })
        .catch(() => {
          finish();
        });
    });
  }

  async function runContinuousPlayback(startAt = 'start') {
    if (!continuousMode || !isPlaying) return;

    const token = continuousPlaybackToken;
    const shouldRun = (step) => startAt === 'start' || startAt === step;

    if (autoEnglish) {
      if (shouldRun('english')) {
        await playContinuousAudio('english');
        if (!continuousMode || token !== continuousPlaybackToken || !isPlaying) return;
      }
      if (shouldRun('english') || shouldRun('betweenEnglishGreek')) {
        await waitForContinuousPause();
        if (!continuousMode || token !== continuousPlaybackToken || !isPlaying) return;
      }
      if (shouldRun('english') || shouldRun('betweenEnglishGreek') || shouldRun('greek')) {
        await playContinuousAudio('greek');
        if (!continuousMode || token !== continuousPlaybackToken || !isPlaying) return;
      }
      await waitForContinuousPause({ durationMs: 2000, useSetting: false });
      if (!continuousMode || token !== continuousPlaybackToken || !isPlaying) return;
    } else {
      if (shouldRun('greek')) {
        await playContinuousAudio('greek');
        if (!continuousMode || token !== continuousPlaybackToken || !isPlaying) return;
      }
      await waitForContinuousPause();
      if (!continuousMode || token !== continuousPlaybackToken || !isPlaying) return;
    }

    advanceCard();
  }

  async function playGreekFromUser() {
    if (!continuousMode || !isPlaying) return playSegment('greek');

    stopContinuousPlayback();
    if (!continuousMode || !isPlaying) return;

    const token = continuousPlaybackToken;
    await playContinuousAudio('greek');
    if (!continuousMode || token !== continuousPlaybackToken || !isPlaying) return;
    await waitForContinuousPause(autoEnglish ? { durationMs: 2000, useSetting: false } : undefined);
    if (!continuousMode || token !== continuousPlaybackToken || !isPlaying) return;
    advanceCard();
  }

  function startContinuousPlayback() {
    if (!continuousMode || !sections.length) return;
    continuousPlaybackToken += 1;
    if (!isPlaying) {
      showCard(0, false, 'next');
    }
    const resumeStep = continuousResumeStep;
    continuousResumeStep = 'start';
    runContinuousPlayback(resumeStep);
  }

  function setGreekAudioButtonActive(isActive) {
    isGreekAudioButtonActive = isActive;
    els.coverTrack
      ?.querySelector('.cover-card.is-center.is-card')
      ?.classList.toggle('is-greek-audio-active', isActive);
  }

  function updateContinuousIndicator() {
    els.continuousIndicator?.classList.toggle('is-visible', continuousMode);
  }

  function updateAudioSource(kind, file) {
    const audio = kind === 'english' ? els.englishAudio : els.greekAudio;
    if (audio && file && audio.getAttribute('src') !== file) audio.src = file;
  }

  function recordAssetParts(record) {
    const match = typeof record?.id === 'string' ? record.id.match(/^([a-z]+)_\d{3}$/) : null;
    return match ? { section: match[1], id: record.id } : null;
  }

  function resolveRecordImage(record) {
    const parts = recordAssetParts(record);
    return parts ? `images/${parts.section}/${parts.id}.png` : '';
  }

  function resolveAudioInfo(record, kind) {
    const parts = recordAssetParts(record);
    if (!parts) return null;
    const languageFolder = kind === 'english' ? 'English' : 'Greek';
    return {
      file: `media/${parts.section}/${languageFolder}/${parts.id}.mp3`,
      startSeconds: 0,
      endSeconds: null
    };
  }

  function waitForMetadata(audio) {
    if (audio.readyState >= 1) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const clean = () => {
        audio.removeEventListener('loadedmetadata', onLoad);
        audio.removeEventListener('error', onError);
      };
      const onLoad = () => { clean(); resolve(); };
      const onError = () => { clean(); reject(new Error('Audio failed to load.')); };
      audio.addEventListener('loadedmetadata', onLoad, { once: true });
      audio.addEventListener('error', onError, { once: true });
      audio.load();
    });
  }

  async function playSegment(kind) {
    const record = currentRecord();
    if (!record) return;
    const audioInfo = resolveAudioInfo(record, kind);
    const audio = kind === 'english' ? els.englishAudio : els.greekAudio;
    if (!audioInfo?.file) return;

    updateAudioSource(kind, audioInfo.file);
    stopAudio();

    try {
      await waitForMetadata(audio);
      audio.playbackRate = kind === 'greek' ? greekAudioSpeed / 100 : 1;
      audio.currentTime = Math.max(0, audioInfo.startSeconds || 0);
      const playbackRate = kind === 'greek' ? greekAudioSpeed / 100 : 1;
      if (Number.isFinite(audioInfo.endSeconds)) {
        activeTimer = window.setTimeout(() => {
          audio.pause();
          if (kind === 'greek') setGreekAudioButtonActive(false);
        }, Math.max(250, ((audioInfo.endSeconds - (audioInfo.startSeconds || 0)) / playbackRate) * 1000 + 120));
      }
      await audio.play();
      if (kind === 'greek') {
        setGreekAudioButtonActive(true);
        audio.addEventListener('ended', () => setGreekAudioButtonActive(false), { once: true });
      }
    } catch (error) {
      if (kind === 'greek') setGreekAudioButtonActive(false);
      console.warn(error);
    }
  }

  function buildCardOrder(section) {
    cardOrder = globalMode
      ? sections.flatMap((deckSection, sectionIndex) => (deckSection.records || []).map((_, cardIndex) => ({ sectionIndex, cardIndex })))
      : (section.records || []).map((_, index) => index);
    if (!isShuffled) return;
    for (let i = cardOrder.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardOrder[i], cardOrder[j]] = [cardOrder[j], cardOrder[i]];
    }
  }

  function preloadSection(index) {
    const section = sections[wrapIndex(index)];
    if (!section) return;
    const nextPosition = Math.min(Math.max(0, currentCardPosition + 1), (cardOrder.length || 1) - 1);
    const nextEntry = globalMode ? cardOrder[nextPosition] : { sectionIndex: wrapIndex(index), cardIndex: cardOrder[nextPosition] ?? 0 };
    const nextRecord = sections[nextEntry?.sectionIndex]?.records?.[nextEntry?.cardIndex];
    [resolveSectionImage(section), resolveSectionHoverImage(section), resolveRecordImage(section.records?.[0]), resolveRecordImage(nextRecord)].forEach((src) => {
      if (!src) return;
      const image = new Image();
      image.src = src;
    });
  }

  function coverCard(section, index, slot) {
    const name = sectionName(section, index);
    const className = slot === 0 ? 'is-center' : 'is-side';
    const tilt = slot < 0 ? '14deg' : '-14deg';
    const activeRecord = isPlaying && slot === 0 ? currentRecord() : null;
    const plainImage = activeRecord ? resolveRecordImage(activeRecord) : resolveSectionImage(section);
    const colorImage = activeRecord ? resolveRecordImage(activeRecord) : resolveSectionHoverImage(section) || resolveSectionImage(section);
    const cardClass = activeRecord ? ' is-card' : '';
    const audioActiveClass = activeRecord && isGreekAudioButtonActive ? ' is-greek-audio-active' : '';
    const flipClass = activeRecord && cardTransition === 'flip' && !suppressNextFlip ? ` flip-${flipDirection}` : '';
    const fadeClass = activeRecord && cardTransition === 'fade' && !suppressNextFlip ? ' fade-in' : '';
    const crossfadeImage = activeRecord && cardTransition === 'fade' && crossfadeFromImage && !suppressNextFlip
      ? `<img class="crossfade-image" src="${crossfadeFromImage}" alt="" />`
      : '';
    const noFlipClass = activeRecord && suppressNextFlip ? ' no-flip' : '';
    const actionLabel = activeRecord ? `Show next ${name} card` : slot === 0 ? `Start ${name}` : `Select ${name}`;

    return `
      <div class="cover-card ${className}${cardClass}${audioActiveClass}${flipClass}${fadeClass}${noFlipClass}" role="button" tabindex="0" data-index="${index}" style="--tilt: ${tilt}" aria-label="${actionLabel}">
        <img class="cover-plain" src="${plainImage}" alt="" />
        <img class="cover-color" src="${colorImage}" alt="" />
        ${crossfadeImage}
        ${activeRecord ? '<span class="greek-audio-button" role="button" tabindex="0" aria-label="Play Greek audio" title="Play Greek"></span>' : ''}
      </div>
    `;
  }

  function renderDots() {
    els.dotRow.innerHTML = sections.map((section, index) => {
      const name = sectionName(section, index);
      return `<button class="dot ${index === activeIndex ? 'is-active' : ''}" type="button" data-index="${index}" aria-label="Go to ${name}"></button>`;
    }).join('');
  }

  function renderCarousel() {
    if (!sections.length) return;
    const section = activeSection();
    const name = sectionName(section, activeIndex);
    const previousIndex = wrapIndex(activeIndex - 1);
    const nextIndex = wrapIndex(activeIndex + 1);
    const recordCount = globalMode
      ? sections.reduce((total, deckSection) => total + resolveRecordCount(deckSection), 0)
      : resolveRecordCount(section);
    const cardNumber = currentCardPosition + 1;

    els.sectionTitle.textContent = globalMode ? 'Global Mode' : name;
    els.sectionMeta.textContent = globalMode
      ? 'All sections combined into one deck'
      : isPlaying ? `Card ${cardNumber} of ${recordCount}` : `Section ${activeIndex + 1} of ${sections.length}`;
    els.sectionMeta.classList.toggle('is-hidden', isPlaying && !globalMode);
    els.countPill.textContent = isPlaying ? `Card ${cardNumber} of ${recordCount}` : `${recordCount} cards`;
    els.selectionView.classList.toggle('is-global', globalMode);
    els.selectionView.classList.toggle('is-playing', isPlaying);
    els.selectionView.classList.toggle('is-helping', isHelpOpen);
    els.topbar.classList.toggle('is-helping', isHelpOpen);
    els.cardControls.classList.toggle('is-visible', isPlaying);
    els.cardPrevButton.disabled = !isPlaying || recordCount < 2;
    els.cardNextButton.disabled = !isPlaying || recordCount < 2;
    els.shuffleToggle.checked = isShuffled;
    els.carouselWindow.classList.toggle('is-playing', isPlaying);

    els.coverTrack.innerHTML = globalMode
      ? coverCard(currentRecordSection(), currentCardEntry().sectionIndex, 0)
      : [
        coverCard(sections[previousIndex], previousIndex, -1),
        coverCard(section, activeIndex, 0),
        coverCard(sections[nextIndex], nextIndex, 1)
      ].join('');

    renderDots();
    preloadSection(activeIndex - 1);
    preloadSection(activeIndex);
    preloadSection(activeIndex + 1);
    suppressNextFlip = false;
    cardTransition = 'flip';
    crossfadeFromImage = '';
  }

  function setActiveIndex(index) {
    stopContinuousPlayback();
    isPlaying = false;
    globalMode = false;
    activeIndex = wrapIndex(index);
    currentCardPosition = -1;
    cardOrder = [];
    renderCarousel();
    if (continuousMode) {
      startContinuousPlayback();
    }
  }

  function showCard(position, shouldPlayEnglish = true, direction = 'next') {
    const section = activeSection();
    if ((!globalMode && (!section || !Array.isArray(section.records) || !section.records.length)) || (globalMode && !sections.some((deckSection) => deckSection.records?.length))) return;
    const wasPlaying = isPlaying;
    const transitionForCard = wasPlaying ? 'flip' : 'fade';
    if (!wasPlaying) crossfadeFromImage = resolveSectionImage(section);
    if (!cardOrder.length) buildCardOrder(section);
    isPlaying = true;
    flipDirection = direction;
    cardTransition = transitionForCard;
    currentCardPosition = (position + cardOrder.length) % cardOrder.length;
    if (globalMode) {
      activeIndex = currentCardEntry().sectionIndex;
    }
    renderCarousel();
    if (shouldPlayEnglish && autoEnglish && !continuousMode) {
      clearTimeout(englishDelayTimer);
      const delayMs = transitionForCard === 'fade' ? 2200 : 420;
      englishDelayTimer = window.setTimeout(() => {
        englishDelayTimer = null;
        playSegment('english');
      }, delayMs);
    }
  }

  function advanceCard() {
    if (continuousMode) {
      stopContinuousPlayback();
    }
    if (!globalMode && isPlaying && cardOrder.length && currentCardPosition >= cardOrder.length - 1) {
      return setActiveIndex(activeIndex + 1);
    }
    showCard(currentCardPosition + 1, !continuousMode, 'next');
    if (continuousMode) {
      startContinuousPlayback();
    }
  }

  function previousCard() {
    if (continuousMode) {
      stopContinuousPlayback();
    }
    if (!globalMode && isPlaying && cardOrder.length && currentCardPosition <= 0) {
      return setActiveIndex(activeIndex - 1);
    }
    showCard(currentCardPosition - 1, !continuousMode, 'prev');
    if (continuousMode) {
      startContinuousPlayback();
    }
  }

  function setShuffle(enabled) {
    isShuffled = enabled;
    els.shuffleToggle.checked = isShuffled;
    showToast(`Shuffle ${isShuffled ? 'on' : 'off'}`);
    if (isPlaying) {
      stopContinuousPlayback();
      buildCardOrder(activeSection());
      showCard(0, !continuousMode, 'next');
      if (continuousMode) {
        startContinuousPlayback();
      }
    }
  }

  function toggleShuffle() {
    setShuffle(!isShuffled);
  }

  function toggleGlobalMode() {
    stopContinuousPlayback();
    globalMode = !globalMode;
    isPlaying = false;
    currentCardPosition = -1;
    cardOrder = [];
    renderCarousel();
    if (globalMode) {
      showCard(0, !continuousMode, 'next');
      if (continuousMode) {
        startContinuousPlayback();
      }
    } else if (continuousMode) {
      startContinuousPlayback();
    }
    showToast(`Global Mode: ${globalMode ? 'on' : 'off'}`);
  }

  function toggleAutoEnglish() {
    autoEnglish = !autoEnglish;
    if (!autoEnglish) {
      stopEnglishAudio();
    }
    showToast(`English ${autoEnglish ? 'on' : 'off'}`);
  }

  function toggleContinuousMode() {
    continuousMode = !continuousMode;
    updateContinuousIndicator();
    if (continuousMode) {
      stopContinuousPlayback();
      if (!isPlaying) {
        showCard(0, false, 'next');
      }
      startContinuousPlayback();
    } else {
      stopContinuousPlayback();
    }
    showToast(`Continuous Mode: ${continuousMode ? 'On' : 'Off'}`);
  }

  function setGreekAudioSpeed(value) {
    greekAudioSpeed = Math.max(75, Math.min(150, value));
    els.speedValue.textContent = `${greekAudioSpeed}%`;
    els.greekAudio.playbackRate = greekAudioSpeed / 100;
    showToast(`Audio Speed: ${greekAudioSpeed}%`);
  }

  function adjustGreekAudioSpeed(delta) {
    setGreekAudioSpeed(greekAudioSpeed + delta);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => {
      els.toast.classList.remove('is-visible');
    }, 1250);
  }

  function openHelp() {
    shouldResumeContinuousAfterHelp = continuousMode && isPlaying;
    if (shouldResumeContinuousAfterHelp) {
      if (currentContinuousPlaybackKind) {
        continuousResumeStep = currentContinuousPlaybackKind;
      } else if (continuousPauseResolve) {
        continuousResumeStep = autoEnglish && continuousPauseUsesSetting ? 'betweenEnglishGreek' : 'afterGreek';
      } else {
        continuousResumeStep = autoEnglish ? 'english' : 'greek';
      }
    }
    if (continuousMode) {
      stopContinuousPlayback();
    } else {
      stopAudio();
    }
    isHelpOpen = true;
    els.selectionView.classList.add('is-helping');
    els.topbar.classList.add('is-helping');
  }

  function closeHelp() {
    isHelpOpen = false;
    suppressNextFlip = true;
    els.selectionView.classList.remove('is-helping');
    els.topbar.classList.remove('is-helping');
    renderCarousel();
    if (shouldResumeContinuousAfterHelp && continuousMode && isPlaying) {
      startContinuousPlayback();
    } else {
      continuousResumeStep = 'start';
    }
    shouldResumeContinuousAfterHelp = false;
  }

  function openPronunciation() {
    isPronunciationOpen = true;
    els.pronunciationPanel.classList.add('is-visible');
    els.pronunciationPanel.setAttribute('aria-hidden', 'false');
  }

  function closePronunciation() {
    isPronunciationOpen = false;
    els.pronunciationPanel.classList.remove('is-visible');
    els.pronunciationPanel.setAttribute('aria-hidden', 'true');
  }

  function togglePronunciation() {
    if (isPronunciationOpen) return closePronunciation();
    return openPronunciation();
  }

  els.helpButton.addEventListener('click', () => {
    if (isHelpOpen) return closeHelp();
    return openHelp();
  });
  els.closeHelpButton.addEventListener('click', closeHelp);
  els.closeHelpIconButton.addEventListener('click', closeHelp);
  els.closePronunciationButton.addEventListener('click', closePronunciation);
  els.cardPrevButton.addEventListener('click', previousCard);
  els.cardNextButton.addEventListener('click', advanceCard);
  els.shuffleToggle.addEventListener('change', (event) => {
    setShuffle(event.target.checked);
  });

  els.coverTrack.addEventListener('click', (event) => {
    if (event.target.closest('.greek-audio-button')) {
      event.stopPropagation();
      playGreekFromUser();
      return;
    }
    const card = event.target.closest('.cover-card');
    if (!card) return;
    const selectedIndex = Number(card.dataset.index);
    if (selectedIndex === activeIndex) advanceCard();
    else setActiveIndex(selectedIndex);
  });

  els.coverTrack.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    if (event.target.closest('.greek-audio-button')) {
      playGreekFromUser();
      return;
    }
    if (isPlaying && event.key === ' ') {
      playGreekFromUser();
      return;
    }
    const card = event.target.closest('.cover-card');
    if (!card) return;
    const selectedIndex = Number(card.dataset.index);
    if (selectedIndex === activeIndex) advanceCard();
    else setActiveIndex(selectedIndex);
  });

  els.dotRow.addEventListener('click', (event) => {
    if (isPlaying) return;
    const button = event.target.closest('.dot');
    if (!button) return;
    setActiveIndex(Number(button.dataset.index));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'p') {
      event.preventDefault();
      return togglePronunciation();
    }

    if (isPronunciationOpen && event.key === 'Escape') {
      event.preventDefault();
      return closePronunciation();
    }

    if (event.key.toLowerCase() === 'h' || event.key === '?') {
      event.preventDefault();
      if (isHelpOpen) return closeHelp();
      return openHelp();
    }

    if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      return toggleShuffle();
    }

    if (event.key.toLowerCase() === 'g') {
      event.preventDefault();
      return toggleGlobalMode();
    }

    if (event.key.toLowerCase() === 'a') {
      event.preventDefault();
      return toggleAutoEnglish();
    }

    if (event.key.toLowerCase() === 'c') {
      event.preventDefault();
      return toggleContinuousMode();
    }

    if (event.key === '[') {
      event.preventDefault();
      return adjustContinuousPauseSeconds(-1);
    }

    if (event.key === ']') {
      event.preventDefault();
      return adjustContinuousPauseSeconds(1);
    }

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      return adjustGreekAudioSpeed(5);
    }

    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      return adjustGreekAudioSpeed(-5);
    }

    if (isHelpOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeHelp();
      }
      return;
    }

    if (event.key === ' ') {
      event.preventDefault();
      if (isPlaying) return playGreekFromUser();
      return advanceCard();
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      return advanceCard();
    }

    const isPreviousKey = event.key === 'ArrowLeft' || event.key === ',' || event.key === '<';
    const isNextKey = event.key === 'ArrowRight' || event.key === '.' || event.key === '>';
    const isSectionKey = event.shiftKey || event.key === '<' || event.key === '>';

    if (isPreviousKey) {
      event.preventDefault();
      if (globalMode) return previousCard();
      if (isPlaying && !isSectionKey) return previousCard();
      return setActiveIndex(activeIndex - 1);
    }

    if (isNextKey) {
      event.preventDefault();
      if (globalMode) return advanceCard();
      if (isPlaying && !isSectionKey) return advanceCard();
      return setActiveIndex(activeIndex + 1);
    }

    if (isPlaying) {
      if (event.key.toLowerCase() === 'e') return playSegment('english');
    }
  });

  if (!sections.length) {
    document.body.innerHTML = '<main class="prototype-shell"><h1>No flashcard data found.</h1></main>';
    return;
  }

  updateContinuousIndicator();
  renderCarousel();
})();
