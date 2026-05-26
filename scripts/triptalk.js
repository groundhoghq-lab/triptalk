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
  let isAboutOpen = false;
  let isSettingsOpen = false;
  let isMenuOpen = false;
  let shouldResumeContinuousAfterHelp = false;
  let shouldResumeContinuousAfterAbout = false;
  let continuousResumeStep = 'start';
  let pressedSectionCard = null;
  let suppressNextCoverClick = false;

  const els = {
    topbar: document.getElementById('topbar'),
    menuButton: document.getElementById('menuButton'),
    mainMenu: document.getElementById('mainMenu'),
    menuSettingsButton: document.getElementById('menuSettingsButton'),
    settingsPanel: document.getElementById('settingsPanel'),
    closeSettingsButton: document.getElementById('closeSettingsButton'),
    settingsContinuousPauseValue: document.getElementById('settingsContinuousPauseValue'),
    settingsPauseDecreaseButton: document.getElementById('settingsPauseDecreaseButton'),
    settingsPauseIncreaseButton: document.getElementById('settingsPauseIncreaseButton'),
    settingsGlobalToggle: document.getElementById('settingsGlobalToggle'),
    settingsEnglishToggle: document.getElementById('settingsEnglishToggle'),
    settingsContinuousToggle: document.getElementById('settingsContinuousToggle'),
    settingsShuffleToggle: document.getElementById('settingsShuffleToggle'),
    settingsTargetAudioSpeedSlider: document.getElementById('settingsTargetAudioSpeedSlider'),
    settingsTargetAudioSpeedValue: document.getElementById('settingsTargetAudioSpeedValue'),
    menuPronunciationButton: document.getElementById('menuPronunciationButton'),
    menuHelpButton: document.getElementById('menuHelpButton'),
    menuAboutButton: document.getElementById('menuAboutButton'),
    aboutPanel: document.getElementById('aboutPanel'),
    closeAboutButton: document.getElementById('closeAboutButton'),
    copyrightYear: document.getElementById('copyrightYear'),
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
    sectionPrevButton: document.getElementById('sectionPrevButton'),
    cardPrevButton: document.getElementById('cardPrevButton'),
    navPlayButton: document.getElementById('navPlayButton'),
    cardNextButton: document.getElementById('cardNextButton'),
    sectionNextButton: document.getElementById('sectionNextButton'),
    continuousIndicator: document.getElementById('continuousIndicator'),
    englishAudio: document.getElementById('englishAudio'),
    greekAudio: document.getElementById('greekAudio'),
    toast: document.getElementById('toast')
  };

  const touchDeviceQuery = window.matchMedia('(pointer: coarse), (hover: none)');

  function syncDeviceClass() {
    document.body.classList.toggle('is-touch-device', touchDeviceQuery.matches);
  }

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

  function resetAudioToStart(kind) {
    const audioInfo = resolveAudioInfo(currentRecord(), kind);
    const audio = kind === 'english' ? els.englishAudio : els.greekAudio;
    if (!audioInfo?.file || !audio) return;

    updateAudioSource(kind, audioInfo.file);
    if (audio.readyState >= 1) {
      audio.currentTime = Math.max(0, audioInfo.startSeconds || 0);
      return;
    }
    audio.load();
  }

  function resetCurrentCard() {
    if (!isPlaying) return;

    stopContinuousPlayback();
    resetAudioToStart('english');
    resetAudioToStart('greek');
    setGreekAudioButtonActive(false);
    updateTransportPlayButton();
    if (autoEnglish) {
      showToast('Card reset');
      return playSegment('english');
    }
    showToast('Card reset');
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
    syncSettingsControls();
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

  async function toggleGreekAudioFromTransport() {
    if (!isPlaying) return;

    if (isGreekAudioButtonActive && !els.greekAudio.paused) {
      els.greekAudio.pause();
      setGreekAudioButtonActive(false);
      return;
    }

    if (canResumeCurrentGreekAudio()) {
      try {
        els.greekAudio.playbackRate = greekAudioSpeed / 100;
        await els.greekAudio.play();
        setGreekAudioButtonActive(true);
      } catch (error) {
        setGreekAudioButtonActive(false);
        console.warn(error);
      }
      return;
    }

    return playGreekFromUser();
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
    els.navPlayButton?.classList.toggle('is-audio-active', isActive);
    updateTransportPlayButton();
  }

  function canResumeCurrentGreekAudio() {
    const currentGreekFile = resolveAudioInfo(currentRecord(), 'greek')?.file;
    return Boolean(
      isPlaying &&
      currentGreekFile &&
      els.greekAudio.getAttribute('src') === currentGreekFile &&
      els.greekAudio.paused &&
      !els.greekAudio.ended &&
      els.greekAudio.currentTime > 0
    );
  }

  function updateTransportPlayButton() {
    if (!els.navPlayButton) return;
    els.navPlayButton.classList.toggle('is-audio-paused', canResumeCurrentGreekAudio());
    const setTransportPlayContent = (label, icon) => {
      els.navPlayButton.innerHTML = `<span class="transport-label">${label}</span><span class="transport-icon">${icon}</span>`;
    };
    if (!isPlaying) {
      const name = sectionName(activeSection(), activeIndex);
      els.navPlayButton.innerHTML = '<span class="transport-label">Start</span>';
      els.navPlayButton.setAttribute('aria-label', `Start ${name}`);
      return;
    }
    if (isGreekAudioButtonActive) {
      setTransportPlayContent('Pause', '⏸');
      els.navPlayButton.setAttribute('aria-label', 'Pause Greek audio');
      return;
    }
    if (canResumeCurrentGreekAudio()) {
      setTransportPlayContent('Resume', '▶');
      els.navPlayButton.setAttribute('aria-label', 'Resume Greek audio');
      return;
    }
    setTransportPlayContent('Play', '▶');
    els.navPlayButton.setAttribute('aria-label', 'Play Greek audio');
  }

  function updateContinuousIndicator() {
    if (!els.continuousIndicator) return;
    const label = `Continuous Mode: ${continuousMode ? 'On' : 'Off'}`;
    els.continuousIndicator.classList.toggle('is-active', continuousMode);
    els.continuousIndicator.setAttribute('aria-label', label);
    els.continuousIndicator.setAttribute('aria-pressed', String(continuousMode));
    els.continuousIndicator.setAttribute('title', label);
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
    const flipClass = activeRecord && cardTransition === 'flip' && !suppressNextFlip ? ` flip-${flipDirection}` : '';
    const fadeClass = activeRecord && cardTransition === 'fade' && !suppressNextFlip ? ' fade-in' : '';
    const crossfadeImage = activeRecord && cardTransition === 'fade' && crossfadeFromImage && !suppressNextFlip
      ? `<img class="crossfade-image" src="${crossfadeFromImage}" alt="" />`
      : '';
    const noFlipClass = activeRecord && suppressNextFlip ? ' no-flip' : '';
    const actionLabel = activeRecord ? `Show next ${name} card` : slot === 0 ? `Start ${name}` : `Select ${name}`;

    return `
      <div class="cover-card ${className}${cardClass}${flipClass}${fadeClass}${noFlipClass}" role="button" tabindex="0" data-index="${index}" style="--tilt: ${tilt}" aria-label="${actionLabel}">
        <img class="cover-plain" src="${plainImage}" alt="" />
        <img class="cover-color" src="${colorImage}" alt="" />
        ${crossfadeImage}
      </div>
    `;
  }

  function renderDots() {
    els.dotRow.innerHTML = sections.map((section, index) => {
      const name = sectionName(section, index);
      return `<button class="dot ${index === activeIndex ? 'is-active' : ''}" type="button" data-index="${index}" aria-label="Go to ${name}" title="${name}"></button>`;
    }).join('');
  }

  function syncSettingsControls() {
    els.settingsGlobalToggle.checked = globalMode;
    els.settingsEnglishToggle.checked = autoEnglish;
    els.settingsContinuousToggle.checked = continuousMode;
    els.settingsShuffleToggle.checked = isShuffled;
    els.settingsContinuousPauseValue.textContent = `${continuousPauseSeconds} sec`;
    els.settingsPauseDecreaseButton.disabled = continuousPauseSeconds <= 0;
    els.settingsPauseIncreaseButton.disabled = continuousPauseSeconds >= 15;
    els.settingsTargetAudioSpeedSlider.value = String(greekAudioSpeed);
    els.settingsTargetAudioSpeedValue.textContent = `${greekAudioSpeed}%`;
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
    els.cardPrevButton.disabled = !isPlaying || recordCount < 2;
    els.cardNextButton.disabled = !isPlaying || recordCount < 2;
    els.sectionPrevButton.disabled = sections.length < 2 || globalMode;
    els.sectionNextButton.disabled = sections.length < 2 || globalMode;
    syncSettingsControls();
    updateTransportPlayButton();
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

  function setActiveIndex(index, { resumeContinuous = true } = {}) {
    stopContinuousPlayback();
    isPlaying = false;
    globalMode = false;
    activeIndex = wrapIndex(index);
    currentCardPosition = -1;
    cardOrder = [];
    renderCarousel();
    if (resumeContinuous && continuousMode) {
      startContinuousPlayback();
    }
  }

  function showCard(position, shouldPlayEnglish = true, direction = 'next') {
    const section = activeSection();
    if ((!globalMode && (!section || !Array.isArray(section.records) || !section.records.length)) || (globalMode && !sections.some((deckSection) => deckSection.records?.length))) return;
    const wasPlaying = isPlaying;
    const transitionForCard = wasPlaying ? 'flip' : 'fade';
    if (!wasPlaying) crossfadeFromImage = resolveSectionHoverImage(section) || resolveSectionImage(section);
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
    syncSettingsControls();
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
    syncSettingsControls();
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
    syncSettingsControls();
    if (!autoEnglish) {
      stopEnglishAudio();
    }
    showToast(`English ${autoEnglish ? 'on' : 'off'}`);
  }

  function toggleContinuousMode() {
    continuousMode = !continuousMode;
    syncSettingsControls();
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

  function setGreekAudioSpeed(value, { showMessage = true } = {}) {
    greekAudioSpeed = Math.max(75, Math.min(150, value));
    syncSettingsControls();
    els.greekAudio.playbackRate = greekAudioSpeed / 100;
    if (showMessage) showToast(`Target Audio Speed: ${greekAudioSpeed}%`);
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

  function captureContinuousResumeStep() {
    if (currentContinuousPlaybackKind) {
      continuousResumeStep = currentContinuousPlaybackKind;
    } else if (continuousPauseResolve) {
      continuousResumeStep = autoEnglish && continuousPauseUsesSetting ? 'betweenEnglishGreek' : 'afterGreek';
    } else {
      continuousResumeStep = autoEnglish ? 'english' : 'greek';
    }
  }

  function openHelp() {
    shouldResumeContinuousAfterHelp = continuousMode && isPlaying;
    if (shouldResumeContinuousAfterHelp) captureContinuousResumeStep();
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

  function openSettings() {
    if (isHelpOpen) closeHelp();
    if (isPronunciationOpen) closePronunciation();
    if (isAboutOpen) closeAbout();
    syncSettingsControls();
    isSettingsOpen = true;
    els.settingsPanel.classList.add('is-visible');
    els.settingsPanel.setAttribute('aria-hidden', 'false');
  }

  function closeSettings() {
    isSettingsOpen = false;
    els.settingsPanel.classList.remove('is-visible');
    els.settingsPanel.setAttribute('aria-hidden', 'true');
  }

  function openAbout() {
    if (isHelpOpen) closeHelp();
    if (isPronunciationOpen) closePronunciation();
    if (isSettingsOpen) closeSettings();
    shouldResumeContinuousAfterAbout = continuousMode && isPlaying;
    if (shouldResumeContinuousAfterAbout) captureContinuousResumeStep();
    if (continuousMode) {
      stopContinuousPlayback();
    } else {
      stopAudio();
    }
    isAboutOpen = true;
    els.aboutPanel.classList.add('is-visible');
    els.aboutPanel.setAttribute('aria-hidden', 'false');
  }

  function closeAbout() {
    isAboutOpen = false;
    els.aboutPanel.classList.remove('is-visible');
    els.aboutPanel.setAttribute('aria-hidden', 'true');
    if (shouldResumeContinuousAfterAbout && continuousMode && isPlaying) {
      startContinuousPlayback();
    }
    shouldResumeContinuousAfterAbout = false;
  }

  function toggleAbout() {
    if (isAboutOpen) return closeAbout();
    return openAbout();
  }

  function resetPressedSectionCard() {
    if (pressedSectionCard) pressedSectionCard.classList.remove('is-touch-active');
    pressedSectionCard = null;
  }

  function isTouchSectionCard(card) {
    return touchDeviceQuery.matches && card && !card.classList.contains('is-card');
  }

  function activateCoverCard(card) {
    const selectedIndex = Number(card.dataset.index);
    if (selectedIndex === activeIndex) advanceCard();
    else setActiveIndex(selectedIndex);
  }

  function previousSection() {
    if (globalMode) return;
    setActiveIndex(activeIndex - 1, { resumeContinuous: false });
  }

  function nextSection() {
    if (globalMode) return;
    setActiveIndex(activeIndex + 1, { resumeContinuous: false });
  }

  function activateTransportPlay() {
    if (isPlaying) return toggleGreekAudioFromTransport();
    return advanceCard();
  }

  function setMenuOpen(isOpen) {
    isMenuOpen = isOpen;
    els.mainMenu.classList.toggle('is-visible', isMenuOpen);
    els.menuButton.setAttribute('aria-expanded', String(isMenuOpen));
  }

  function toggleMenu() {
    setMenuOpen(!isMenuOpen);
  }

  els.menuButton.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleMenu();
  });
  els.menuSettingsButton.addEventListener('click', () => {
    setMenuOpen(false);
    return openSettings();
  });
  els.continuousIndicator.addEventListener('click', () => {
    toggleContinuousMode();
  });
  els.settingsPauseDecreaseButton.addEventListener('click', () => {
    adjustContinuousPauseSeconds(-1);
  });
  els.settingsPauseIncreaseButton.addEventListener('click', () => {
    adjustContinuousPauseSeconds(1);
  });
  els.settingsGlobalToggle.addEventListener('change', () => {
    toggleGlobalMode();
  });
  els.settingsEnglishToggle.addEventListener('change', () => {
    toggleAutoEnglish();
  });
  els.settingsContinuousToggle.addEventListener('change', () => {
    toggleContinuousMode();
  });
  els.settingsShuffleToggle.addEventListener('change', (event) => {
    setShuffle(event.target.checked);
  });
  els.settingsTargetAudioSpeedSlider.addEventListener('input', (event) => {
    setGreekAudioSpeed(Number(event.target.value), { showMessage: false });
  });
  els.settingsTargetAudioSpeedSlider.addEventListener('change', (event) => {
    setGreekAudioSpeed(Number(event.target.value));
  });
  els.menuPronunciationButton.addEventListener('click', () => {
    setMenuOpen(false);
    return openPronunciation();
  });
  els.menuHelpButton.addEventListener('click', () => {
    setMenuOpen(false);
    if (isHelpOpen) return closeHelp();
    return openHelp();
  });
  els.menuAboutButton.addEventListener('click', () => {
    setMenuOpen(false);
    return openAbout();
  });
  els.closeSettingsButton.addEventListener('click', closeSettings);
  els.closeAboutButton.addEventListener('click', closeAbout);
  els.closeHelpButton.addEventListener('click', closeHelp);
  els.closeHelpIconButton.addEventListener('click', closeHelp);
  els.closePronunciationButton.addEventListener('click', closePronunciation);
  els.sectionPrevButton.addEventListener('click', previousSection);
  els.cardPrevButton.addEventListener('click', previousCard);
  els.navPlayButton.addEventListener('click', activateTransportPlay);
  els.cardNextButton.addEventListener('click', advanceCard);
  els.sectionNextButton.addEventListener('click', nextSection);
  els.coverTrack.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary) return;
    const card = event.target.closest('.cover-card');
    if (!isTouchSectionCard(card)) return;
    resetPressedSectionCard();
    pressedSectionCard = card;
    card.classList.add('is-touch-active');
    if (card.setPointerCapture) card.setPointerCapture(event.pointerId);
  });

  els.coverTrack.addEventListener('pointerup', (event) => {
    if (!event.isPrimary || !pressedSectionCard) return;
    const card = pressedSectionCard;
    resetPressedSectionCard();
    if (!isTouchSectionCard(card)) return;
    const releaseTarget = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cover-card');
    if (releaseTarget !== card) return;
    suppressNextCoverClick = true;
    activateCoverCard(card);
  });

  els.coverTrack.addEventListener('pointercancel', () => {
    resetPressedSectionCard();
  });

  els.coverTrack.addEventListener('click', (event) => {
    if (suppressNextCoverClick) {
      suppressNextCoverClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const card = event.target.closest('.cover-card');
    if (!card) return;
    activateCoverCard(card);
  });

  els.coverTrack.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    if (isPlaying && event.key === ' ') {
      toggleGreekAudioFromTransport();
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

  document.addEventListener('click', (event) => {
    if (!isMenuOpen || event.target.closest('.brand')) return;
    setMenuOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (isMenuOpen && event.key === 'Escape') {
      event.preventDefault();
      return setMenuOpen(false);
    }

    if (isSettingsOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        return closeSettings();
      }

      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        return toggleShuffle();
      }

      if (event.key.toLowerCase() === 'g') {
        event.preventDefault();
        return toggleGlobalMode();
      }

      if (event.key.toLowerCase() === 'e') {
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
      return;
    }

    if (event.key.toLowerCase() === 'i') {
      event.preventDefault();
      setMenuOpen(false);
      return toggleAbout();
    }

    if (isAboutOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAbout();
      }
      return;
    }

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
      setMenuOpen(false);
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

    if (event.key.toLowerCase() === 'e') {
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
      if (isPlaying) return toggleGreekAudioFromTransport();
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
      if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        return resetCurrentCard();
      }
    }
  });

  if (!sections.length) {
    document.body.innerHTML = '<main class="prototype-shell"><h1>No flashcard data found.</h1></main>';
    return;
  }

  syncDeviceClass();
  if (touchDeviceQuery.addEventListener) {
    touchDeviceQuery.addEventListener('change', syncDeviceClass);
  } else if (touchDeviceQuery.addListener) {
    touchDeviceQuery.addListener(syncDeviceClass);
  }

  els.copyrightYear.textContent = new Date().getFullYear();
  updateContinuousIndicator();
  renderCarousel();
})();
