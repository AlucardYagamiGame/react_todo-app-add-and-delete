import React, { useEffect, useRef, useState } from 'react';
import cn from 'classnames';
import { createTodo, deleteTodo, getTodos, USER_ID } from './api/todos';
import { ErrorNotification } from './components/ErrorNotification';
import { Footer } from './components/Footer';
import { NewTodo } from './components/NewTodo';
import { TodoList } from './components/TodoList';
import { FilterType } from './types/FilterType';
import { ErrorMessage } from './types/ErrorMessage';
import { Todo } from './types/Todo';
import { UserWarning } from './UserWarning';

const ERROR_TIMEOUT = 3000;

export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingTodoIds, setLoadingTodoIds] = useState<number[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [errorMessage, setErrorMessage] = useState<ErrorMessage | null>(null);

  const newTodoFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!USER_ID) {
      return;
    }

    getTodos()
      .then(setTodos)
      .catch(() => setErrorMessage(ErrorMessage.LOAD));
  }, []);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setErrorMessage(null);
    }, ERROR_TIMEOUT);

    return () => window.clearTimeout(timerId);
  }, [errorMessage]);

  useEffect(() => {
    newTodoFieldRef.current?.focus();
  }, [isSubmitting, todos]);

  const handleAddTodo = async (title: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setTempTodo({ id: 0, title, completed: false, userId: USER_ID });

    try {
      const newTodo = await createTodo({
        title,
        userId: USER_ID,
        completed: false,
      });

      setTodos(currentTodos => [...currentTodos, newTodo]);
    } catch {
      setErrorMessage(ErrorMessage.ADD);

      throw new Error('Unable to add a todo');
    } finally {
      setIsSubmitting(false);
      setTempTodo(null);
    }
  };

  const handleDeleteTodo = (todoId: number) => {
    setLoadingTodoIds(currentIds => [...currentIds, todoId]);

    deleteTodo(todoId)
      .then(() => {
        setTodos(currentTodos =>
          currentTodos.filter(todo => todo.id !== todoId),
        );
      })
      .catch(() => {
        setErrorMessage(ErrorMessage.DELETE);
      })
      .finally(() => {
        setLoadingTodoIds(currentIds => currentIds.filter(id => id !== todoId));
      });
  };

  const handleClearCompleted = () => {
    const completedTodoIds = todos
      .filter(todo => todo.completed)
      .map(todo => todo.id);

    setLoadingTodoIds(currentIds => [...currentIds, ...completedTodoIds]);

    Promise.allSettled(
      completedTodoIds.map(todoId => deleteTodo(todoId).then(() => todoId)),
    )
      .then(results => {
        const deletedIds = results
          .filter(
            (result): result is PromiseFulfilledResult<number> =>
              result.status === 'fulfilled',
          )
          .map(result => result.value);

        if (results.some(result => result.status === 'rejected')) {
          setErrorMessage(ErrorMessage.DELETE);
        }

        setTodos(currentTodos =>
          currentTodos.filter(todo => !deletedIds.includes(todo.id)),
        );
      })
      .finally(() => {
        setLoadingTodoIds(currentIds =>
          currentIds.filter(id => !completedTodoIds.includes(id)),
        );
      });
  };

  const visibleTodos = todos.filter(todo => {
    switch (filter) {
      case 'active':
        return !todo.completed;

      case 'completed':
        return todo.completed;

      default:
        return true;
    }
  });

  if (!USER_ID) {
    return <UserWarning />;
  }

  const isAllCompleted = todos.every(todo => todo.completed);

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">
          {/* this button should have `active` class only if all todos are completed */}
          <button
            type="button"
            data-cy="ToggleAllButton"
            aria-label="Toggle all todos"
            className={cn('todoapp__toggle-all', {
              active: isAllCompleted,
            })}
          />

          <NewTodo
            isSubmitting={isSubmitting}
            inputRef={newTodoFieldRef}
            onAdd={handleAddTodo}
            onError={setErrorMessage}
          />
        </header>

        {(todos.length > 0 || tempTodo) && (
          <TodoList
            todos={visibleTodos}
            tempTodo={tempTodo}
            loadingTodoIds={loadingTodoIds}
            onDelete={handleDeleteTodo}
          />
        )}

        {todos.length > 0 && (
          <Footer
            todos={todos}
            filter={filter}
            onFilterChange={setFilter}
            onClearCompleted={handleClearCompleted}
          />
        )}
      </div>

      {/* DON'T use conditional rendering to hide the notification */}
      {/* Add the 'hidden' class to hide the message smoothly */}
      <ErrorNotification
        errorMessage={errorMessage}
        onClose={() => setErrorMessage(null)}
      />
    </div>
  );
};
