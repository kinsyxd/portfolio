// Настройки скорости анимаций
var SPEED = 5;           // Скорость печати текста (мс)
var SCROLL_SPEED = 3;    // Скорость прокрутки (пиксели)

// Текст приглашения командной строки
var PROMPT_TEXT = 'user@portfolio >';

// Основные элементы страницы
var terminalBody = document.querySelector('.terminal-body');

// Переменные для управления прокруткой
var isScrolling = false;
var scrollAnimationId = null;


// Ждём загрузки шрифтов перед показом страницы
// Если шрифты не загрузились за 3 секунды - показываем страницу всё равно
var fontsTimeout = new Promise(function(resolve) {
    setTimeout(resolve, 3000);
});

Promise.race([document.fonts.ready, fontsTimeout]).then(function() {
    // Показываем страницу
    document.body.classList.add('fonts-loaded');
    
    // Автоматически открываем секцию "обо_мне" через 300мс
    setTimeout(function() {
        var aboutCommand = document.querySelector('[data-target="about"]');
        if (aboutCommand) {
            toggleSection(aboutCommand);
        }
    }, 300);
});


// Останавливаем анимацию прокрутки при ручной прокрутке
terminalBody.addEventListener('wheel', stopScrollAnimation);
terminalBody.addEventListener('touchmove', stopScrollAnimation);

// Кнопка закрытия окна
var closeButton = document.querySelector('.win-btn.close');
if (closeButton) {
    closeButton.addEventListener('click', function() {
        window.close();
        // Если браузер не разрешает закрыть окно - показываем заглушку
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#6d6d6d;font-family:monospace;">Окно закрыто</div>';
    });
}

// Обработка кликов по командам терминала
var commands = document.querySelectorAll('.command');
commands.forEach(function(cmd) {
    cmd.addEventListener('click', function() {
        toggleSection(cmd);
    });
});


// Открытие или закрытие секции по клику на команду
function toggleSection(command) {
    var outputId = command.dataset.target;
    var output = document.getElementById(outputId);
    var prompt = command.querySelector('.prompt');
    
    // Если секция уже открыта - закрываем её
    if (output.classList.contains('visible')) {
        output.classList.replace('visible', 'hidden');
        command.classList.remove('active');
        restoreContent(output);
        animatePromptTyping(prompt, PROMPT_TEXT, 0);
        return;
    }
    
    // Открываем секцию - сначала стираем prompt
    animatePromptDeleting(prompt, function() {
        command.classList.add('active');
        output.classList.replace('hidden', 'visible');
        scrollToSection(command.closest('section'));
        animateTyping(output);
    });
}


// Анимация стирания prompt (посимвольно с конца)
function animatePromptDeleting(promptElement, callback) {
    var text = promptElement.textContent;
    
    if (text.length === 0) {
        if (callback) callback();
        return;
    }
    
    // Удаляем последний символ
    promptElement.textContent = text.slice(0, -1);
    
    // Продолжаем через небольшую задержку
    setTimeout(function() {
        animatePromptDeleting(promptElement, callback);
    }, SPEED * 2);
}

// Анимация печати prompt (посимвольно)
function animatePromptTyping(promptElement, text, charIndex) {
    if (charIndex < text.length) {
        promptElement.textContent += text[charIndex];
        setTimeout(function() {
            animatePromptTyping(promptElement, text, charIndex + 1);
        }, SPEED * 2);
    }
}


// Останавливает текущую анимацию прокрутки
function stopScrollAnimation() {
    isScrolling = false;
    if (scrollAnimationId) {
        cancelAnimationFrame(scrollAnimationId);
    }
}

// Плавная прокрутка к нужной секции
function scrollToSection(section) {
    if (!section) return;
    
    stopScrollAnimation();
    
    var command = section.querySelector('.command');
    if (!command) return;
    
    var commandRect = command.getBoundingClientRect();
    var bodyRect = terminalBody.getBoundingClientRect();
    var bodyHeight = bodyRect.height;
    
    // Определяем границу нижней трети экрана
    var lowerThirdBoundary = bodyRect.top + bodyHeight * (2/3);
    
    // Скроллим только если команда находится в нижней трети экрана
    if (commandRect.top > lowerThirdBoundary) {
        var targetScroll = terminalBody.scrollTop + commandRect.top - bodyRect.top - 10;
        var previousScrollTop = -1;
        isScrolling = true;
        
        // Функция анимации одного кадра прокрутки
        function animateOneFrame() {
            var maxScroll = terminalBody.scrollHeight - terminalBody.clientHeight;
            var currentScroll = terminalBody.scrollTop;
            var remainingDistance = targetScroll - currentScroll;
            
            // Останавливаемся если: прервано, достигли цели, достигли конца
            if (!isScrolling || remainingDistance <= 1 || currentScroll >= maxScroll) {
                isScrolling = false;
                return;
            }
            
            // Проверяем не застрял ли скролл
            if (previousScrollTop === currentScroll && previousScrollTop !== -1) {
                isScrolling = false;
                return;
            }
            
            previousScrollTop = currentScroll;
            terminalBody.scrollTop += SCROLL_SPEED;
            scrollAnimationId = requestAnimationFrame(animateOneFrame);
        }
        
        scrollAnimationId = requestAnimationFrame(animateOneFrame);
    }
}


// Запускает анимацию печати для всех элементов в контейнере
function animateTyping(container) {
    // Находим все элементы для анимации (параграфы и элементы списка)
    var elements = container.querySelectorAll('p:not(.btn-row), li');
    var buttons = container.querySelectorAll('.btn-row');
    var parsedTokens = [];
    
    // Фиксируем минимальную высоту чтобы контент не прыгал
    container.style.minHeight = container.offsetHeight + 'px';
    
    // Сохраняем оригинальный HTML и очищаем элементы
    elements.forEach(function(el) {
        if (!el.dataset.original) {
            el.dataset.original = el.innerHTML;
        }
        parsedTokens.push(parseHtmlToTokens(el.dataset.original));
        el.innerHTML = '';
    });
    
    // Скрываем кнопки на время анимации
    buttons.forEach(function(btn) {
        btn.classList.remove('show');
    });
    
    // Создаём курсор
    var cursor = document.createElement('span');
    cursor.className = 'cursor';
    cursor.textContent = '_';
    
    // Печатаем элементы по очереди
    var currentIndex = 0;
    
    function typeNextElement() {
        if (currentIndex < elements.length) {
            elements[currentIndex].appendChild(cursor);
            typeTokens(elements[currentIndex], parsedTokens[currentIndex], 0, cursor, typeNextElement);
            currentIndex++;
        } else {
            // Анимация завершена
            cursor.remove();
            container.style.minHeight = '';
            buttons.forEach(function(btn) {
                btn.classList.add('show');
            });
        }
    }
    
    typeNextElement();
}

/*
 * Разбирает HTML-строку на массив токенов
 * Токен может быть:
 * - текстовым символом: { type: 'text', char: 'а' }
 * - HTML-тегом: { type: 'tag', tag: '<strong>', isClose: false }
 * 
 * Это нужно чтобы при анимации печати сохранялось форматирование (жирный текст и т.д.)
 */
function parseHtmlToTokens(html) {
    var tokens = [];
    var i = 0;
    
    while (i < html.length) {
        // Если встретили начало тега
        if (html[i] === '<') {
            var tagEnd = html.indexOf('>', i);
            if (tagEnd !== -1) {
                var tag = html.slice(i, tagEnd + 1);
                var isClosingTag = tag.startsWith('</');
                tokens.push({
                    type: 'tag',
                    tag: tag,
                    isClose: isClosingTag
                });
                i = tagEnd + 1;
                continue;
            }
        }
        
        // Обычный текстовый символ
        tokens.push({
            type: 'text',
            char: html[i]
        });
        i++;
    }
    
    return tokens;
}

/*
 * Печатает токены с сохранением HTML-структуры
 * 
 * Алгоритм:
 * - Если токен это открывающий тег (<strong>) - создаём элемент и помещаем курсор внутрь
 * - Если токен это закрывающий тег (</strong>) - перемещаем курсор наружу элемента
 * - Если токен это символ - печатаем его с задержкой
 * 
 * Таким образом текст внутри <strong> сразу будет жирным во время печати
 */
function typeTokens(rootElement, tokens, tokenIndex, cursor, callback) {
    // Все токены напечатаны
    if (tokenIndex >= tokens.length) {
        if (cursor.parentNode) {
            cursor.parentNode.removeChild(cursor);
        }
        if (callback) callback();
        return;
    }
    
    var token = tokens[tokenIndex];
    var currentParent = cursor.parentNode;
    
    if (token.type === 'tag') {
        if (token.isClose) {
            // Закрывающий тег - выходим из текущего элемента
            if (currentParent && currentParent !== rootElement && currentParent.parentNode) {
                currentParent.parentNode.insertBefore(cursor, currentParent.nextSibling);
            }
        } else {
            // Открывающий тег - создаём новый элемент
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = token.tag;
            var newElement = tempDiv.firstChild;
            
            if (newElement && newElement.nodeType === 1) {
                currentParent.insertBefore(newElement, cursor);
                newElement.appendChild(cursor);
            }
        }
        
        // Теги обрабатываем мгновенно (без задержки)
        typeTokens(rootElement, tokens, tokenIndex + 1, cursor, callback);
        
    } else {
        // Текстовый символ - печатаем с задержкой
        var textNode = document.createTextNode(token.char);
        currentParent.insertBefore(textNode, cursor);
        
        setTimeout(function() {
            typeTokens(rootElement, tokens, tokenIndex + 1, cursor, callback);
        }, SPEED);
    }
}

// Восстанавливает оригинальный контент при закрытии секции
function restoreContent(container) {
    var elements = container.querySelectorAll('p:not(.btn-row), li');
    
    elements.forEach(function(el) {
        if (el.dataset.original) {
            el.innerHTML = el.dataset.original;
        }
    });
    
    // Удаляем курсор если остался
    var cursor = container.querySelector('.cursor');
    if (cursor) {
        cursor.remove();
    }
}


// Кнопка копирования email
var emailButton = document.getElementById('email-btn');
if (emailButton) {
    emailButton.addEventListener('click', function(e) {
        e.preventDefault();
        
        var email = emailButton.dataset.email;
        var textSpan = emailButton.querySelector('.email-text');
        
        // Копируем email в буфер обмена
        navigator.clipboard.writeText(email).then(function() {
            // Меняем текст на "Скопировано"
            textSpan.textContent = 'Скопировано';
            
            // Через 5 секунд возвращаем обратно
            setTimeout(function() {
                textSpan.textContent = 'E-mail';
            }, 5000);
        });
    });
}
