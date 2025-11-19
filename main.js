// Initialize AOS (Animate On Scroll)
AOS.init({
    duration: 1200,
    easing: 'ease-out-cubic',
    once: false, // animations repeat on scroll up/down
    offset: 120, // trigger animations earlier (120px before element enters viewport)
    delay: 50, // small delay for staggered effect
    anchorPlacement: 'top-bottom' // start animation when top of element hits bottom of viewport
  });
  
  // Update the footer year automatically
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.innerText = new Date().getFullYear();
  }
  
  // Typed.js in hero
  const typedElement = document.getElementById('typed-element');
  if (typedElement) {
    var typed = new Typed('#typed-element', {
      strings: [
        "a Software Developer",
        "focused on AI",
        "interested in Cybersecurity"
      ],
      typeSpeed: 80,
      backSpeed: 50,
      loop: true
    });
  }
  
  // DARK MODE TOGGLE
  const darkModeToggle = document.getElementById('darkModeToggle');
  const bodyElement = document.body;
  
  // Check localStorage for dark mode setting
  if (localStorage.getItem('darkMode') === 'enabled') {
    bodyElement.classList.add('dark-mode');
    if (darkModeToggle) darkModeToggle.checked = true;
  }
  
  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', () => {
      if (darkModeToggle.checked) {
        bodyElement.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'enabled');
      } else {
        bodyElement.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'disabled');
      }
    });
  }
  
  // BACK TO TOP BUTTON
  const backToTopBtn = document.getElementById('backToTopBtn');
  
  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      // Show the button after scrolling down 300px
      if (window.scrollY > 300) {
        backToTopBtn.style.display = "block";
      } else {
        backToTopBtn.style.display = "none";
      }
    });
  
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // PROJECTS CARD BUILDER
  const langColorMap = {
    'python': 'bg-python',
    'python3': 'bg-python',
    'javascript': 'bg-javascript',
    'html': 'bg-html',
    'css': 'bg-css',
    'go': 'bg-go',
    'bash': 'bg-bash',
    'shell': 'bg-shell',
    'typescript': 'bg-typescript',
    'makefile': 'bg-shell',
    'rust': 'bg-rust',
    'ros2': 'bg-ros2',
    'opencv': 'bg-opencv',
    'pyqt5': 'bg-pyqt5',
    'slam': 'bg-slam'
  };

const CACHE_DURATION = 86400000; 

document.addEventListener('DOMContentLoaded', () => {
    const repoContainer = document.getElementById('repo-container');
    const storedData = localStorage.getItem('cachedRepos');
    const storedTimestamp = localStorage.getItem('cachedReposTimestamp');
    const now = Date.now();

    // Extract AHSR card if it exists
    const ahsrCard = repoContainer.querySelector('[data-date]');
    const ahsrCardClone = ahsrCard ? ahsrCard.cloneNode(true) : null;

    if (storedData && storedTimestamp && (now - storedTimestamp < CACHE_DURATION)) {
      console.log('Using cached data');
      const dataArray = JSON.parse(storedData);
      
      // Add AHSR card if it exists
      if (ahsrCardClone) {
        const ahsrDate = ahsrCardClone.getAttribute('data-date');
        dataArray.push({
          repo: {
            name: 'AHSR (Autonomous Hospital Stretcher Robot)',
            pushed_at: ahsrDate ? new Date(ahsrDate).toISOString() : new Date('2024-12-31').toISOString(),
            html_url: null,
            private: true
          },
          languages: ['Python', 'ROS2', 'OpenCV', 'PyQt5', 'SLAM'],
          isAHSR: true,
          ahsrCard: ahsrCardClone
        });
      }
      
      // Sort descending by 'pushed_at'
      dataArray.sort((a, b) => new Date(b.repo.pushed_at) - new Date(a.repo.pushed_at));
      renderAll(dataArray);
    } else {
      console.log('Fetching from GitHub');
      fetchReposAndLanguages();
    }

    function fetchReposAndLanguages() {
      // Extract the hardcoded AHSR card if it exists
      const ahsrCard = repoContainer.querySelector('[data-date]');
      const ahsrCardClone = ahsrCard ? ahsrCard.cloneNode(true) : null;
      
      repoContainer.innerHTML = '';

      fetch('https://api.github.com/users/Technical-1/repos?per_page=100')
        .then(res => res.json())
        .then(repos => {
          const filtered = repos; // Filter if needed: repos.filter(r => !r.fork && !r.archived)

          const finalData = [];

          const fetchPromises = filtered.map(repo => {
            return fetch(repo.languages_url)
              .then(langRes => langRes.json())
              .then(langData => {
                finalData.push({ repo, languages: Object.keys(langData), isAHSR: false });
              })
              .catch(err => {
                console.error('Error fetching languages:', err);
                finalData.push({ repo, languages: [], isAHSR: false });
              });
          });

          Promise.all(fetchPromises).then(() => {
            // Add AHSR card as a special entry if it exists
            if (ahsrCardClone) {
              const ahsrDate = ahsrCardClone.getAttribute('data-date');
              finalData.push({
                repo: {
                  name: 'AHSR (Autonomous Hospital Stretcher Robot)',
                  pushed_at: ahsrDate ? new Date(ahsrDate).toISOString() : new Date('2024-12-31').toISOString(),
                  html_url: null,
                  private: true
                },
                languages: ['Python', 'ROS2', 'OpenCV', 'PyQt5', 'SLAM'],
                isAHSR: true,
                ahsrCard: ahsrCardClone
              });
            }

            // Sort them descending by pushed_at
            finalData.sort((a, b) => new Date(b.repo.pushed_at) - new Date(a.repo.pushed_at));

            // Cache in localStorage (excluding AHSR card)
            const cacheData = finalData.filter(item => !item.isAHSR);
            localStorage.setItem('cachedRepos', JSON.stringify(cacheData));
            localStorage.setItem('cachedReposTimestamp', Date.now());

            // Render
            renderAll(finalData);
          });
        })
        .catch(err => {
          console.error('Error fetching repos:', err);
          if (ahsrCardClone) {
            repoContainer.appendChild(ahsrCardClone);
          } else {
            repoContainer.textContent = 'Failed to load repos';
          }
        });
    }

    function renderAll(dataArray) {
      // Extract the hardcoded AHSR card if it exists in the DOM
      const ahsrCard = repoContainer.querySelector('[data-date]');
      const ahsrCardClone = ahsrCard ? ahsrCard.cloneNode(true) : null;
      
      // Clear container
      repoContainer.innerHTML = '';
      
      // Render all cards in sorted order
      dataArray.forEach(item => {
        if (item.isAHSR && item.ahsrCard) {
          // Use the saved AHSR card
          repoContainer.appendChild(item.ahsrCard);
        } else if (item.isAHSR && ahsrCardClone) {
          // Fallback: use the card from DOM if available
          repoContainer.appendChild(ahsrCardClone.cloneNode(true));
        } else {
          // Build GitHub repo card
          const card = buildRepoCard(item.repo, item.languages);
          repoContainer.appendChild(card);
        }
      });
    }
  });

function fetchReposAndLanguages() {
  const repoContainer = document.getElementById('repo-container');
  repoContainer.innerHTML = '';

  fetch('https://api.github.com/users/Technical-1/repos?per_page=30')
    .then(res => res.json())
    .then(repos => {
      const filtered = repos;

      const finalData = [];

      // For each repo, fetch languages
      const fetchPromises = filtered.map(repo => {
        return fetch(repo.languages_url)
          .then(langRes => langRes.json())
          .then(langData => {
            const languages = Object.keys(langData);
            // Save combined result into finalData
            finalData.push({ repo, languages });
          })
          .catch(err => {
            console.error('Error fetching languages:', err);
            finalData.push({ repo, languages: [] });
          });
      });

      // Once all language fetches complete, we render & store in localStorage
      Promise.all(fetchPromises).then(() => {
        // Store in localStorage
        localStorage.setItem('cachedRepos', JSON.stringify(finalData));
        localStorage.setItem('cachedReposTimestamp', Date.now());

        // Render
        finalData.forEach(item => {
          const card = buildRepoCard(item.repo, item.languages);
          repoContainer.appendChild(card);
        });
      });
    })
    .catch(err => {
      console.error('Error fetching repos:', err);
      repoContainer.textContent = 'Failed to load repos';
    });
}

function buildRepoCard(repo, languagesArray) {
  const {
    name,
    description,
    html_url,
    private: isPrivate,
    pushed_at
  } = repo;

  // Build "last updated"
  let lastUpdatedText = '';
  if (pushed_at) {
    const dateObj = new Date(pushed_at);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    lastUpdatedText = `Last updated: ${dateObj.toLocaleDateString(undefined, options)}`;
  }

  // Card wrapper
  let wrapper;
  if (!isPrivate) {
    wrapper = document.createElement('a');
    wrapper.href = html_url;
    wrapper.target = '_blank';
    wrapper.rel = 'noopener';
  } else {
    wrapper = document.createElement('div');
  }
  wrapper.className = 'project-card-wrapper';
  wrapper.setAttribute('data-aos', 'fade-up');

  const titleDiv = document.createElement('div');
  titleDiv.className = 'repo-title';

  const repoNameSpan = document.createElement('span');
  repoNameSpan.className = 'repo-name';
  repoNameSpan.textContent = name;

  // Public / Private label (Decided not needed)
  //const repoLabelSpan = document.createElement('span');
  //repoLabelSpan.className = 'repo-label';
  //repoLabelSpan.textContent = isPrivate ? '(Private)' : '(Public)';

  titleDiv.appendChild(repoNameSpan);
  //titleDiv.appendChild(repoLabelSpan);

  // Description
  const descP = document.createElement('p');
  descP.className = 'repo-desc';
  descP.textContent = description || 'No description provided.';

  // Last updated
  const dateP = document.createElement('p');
  dateP.className = 'repo-date';
  dateP.textContent = lastUpdatedText;

  // Language row with dot + label
  const langDiv = document.createElement('div');
  langDiv.className = 'languages';

  languagesArray.forEach(lang => {
    const lowerLang = lang.toLowerCase();

    const badge = document.createElement('div');
    badge.className = 'tech-badge';

    const dot = document.createElement('span');
    dot.className = 'tech-dot';

    // If known color, apply it
    if (langColorMap[lowerLang]) {
      dot.classList.add(langColorMap[lowerLang]);
    }

    badge.appendChild(dot);
    badge.appendChild(document.createTextNode(lang));
    langDiv.appendChild(badge);
  });

  // Append all
  wrapper.appendChild(titleDiv);
  wrapper.appendChild(descP);
  wrapper.appendChild(dateP);
  wrapper.appendChild(langDiv);

  return wrapper;
}
