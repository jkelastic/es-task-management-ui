import api from './server/routes';
import { initRoutes } from '/Users/jkuang/Downloads/devRepo/kibana/x-pack/test/plugin_api_integration/plugins/task_manager/init_routes';


export default function (kibana) {
  return new kibana.Plugin({
    name: 'es-task-management-ui',
    require: ['elasticsearch', 'task_manager'],

    config(Joi) {
      return Joi.object({
        enabled: Joi.boolean().default(true),
      }).default();
    },
uiExports: {
      // Register the app component of our plugin to uiExports
      app: {
        // The title of the app (will be shown to the user)
        title: 'Indices',
        // An description of the application.
        description: 'An awesome Kibana plugin',
        // The require reference to the JavaScript file for this app
        main: 'plugins/es-task-management-ui/app',
        // The require reference to the icon of the app
        icon: 'plugins/es-task-management-ui/icon.svg'
      }
    },
    init(server) {
      const { taskManager } = server;

      taskManager.registerTaskDefinitions({
        sampleTask: {
          title: 'Sample Task',
          description: 'A sample task for testing the task_manager.',
          timeout: '1m',
          numWorkers: 2,

          // This task allows tests to specify its behavior (whether it reschedules itself, whether it errors, etc)
          // taskInstance.params has the following optional fields:
          // nextRunMilliseconds: number - If specified, the run method will return a runAt that is now + nextRunMilliseconds
          // failWith: string - If specified, the task will throw an error with the specified message
          createTaskRunner: ({ kbnServer, taskInstance }) => ({
            async run() {
              const { params, state } = taskInstance;
              const prevState = state || { count: 0 };

              if (params.failWith) {
                throw new Error(params.failWith);
              }

              const callCluster = kbnServer.server.plugins.elasticsearch.getCluster('admin').callWithInternalUser;
              await callCluster('index', {
                index: '.task_manager_test_result',
                body: {
                  type: 'task',
                  taskId: taskInstance.id,
                  params: JSON.stringify(params),
                  state: JSON.stringify(state),
                  ranAt: new Date(),
                },
                refresh: true,
              });

              const { callWithRequest } = server.plugins.elasticsearch.getCluster('data');
callWithRequest(request, 'cluster.health').then(response => {
  console.log(`cluster status is: #{response.status}`);
})

              return {
                state: { count: (prevState.count || 0) + 1 },
                runAt: millisecondsFromNow(params.nextRunMilliseconds),
              };
            },
          }),
        },
      });

      taskManager.addMiddleware({
        async beforeSave({ taskInstance, ...opts }) {
          const modifiedInstance = {
            ...taskInstance,
            params: {
              originalParams: taskInstance.params,
              superFly: 'My middleware param!',
            },
          };

          return {
            ...opts,
            taskInstance: modifiedInstance,
          };
        },

        async beforeRun({ taskInstance, ...opts }) {
          return {
            ...opts,
            taskInstance: {
              ...taskInstance,
              params: taskInstance.params.originalParams,
            },
          };
        },
      });

      initRoutes(server);
    },
  });
}

function millisecondsFromNow(ms) {
  if (!ms) {
    return;
  }

  const dt = new Date();
  dt.setTime(dt.getTime() + ms);
  return dt;
}
