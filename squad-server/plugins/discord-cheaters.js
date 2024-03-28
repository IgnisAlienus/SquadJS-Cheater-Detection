//Plugin by PSG - Ignis - Press Start Gaming using JetDave's Original Tool Code at https://github.com/fantinodavide/Squad-Log-To-Graph
import DiscordBasePlugin from './discord-base-plugin.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

import DataStore from '../utils/data-store.js';
import Analyzer from '../utils/analyzer.js';
export default class DiscordCheaters extends DiscordBasePlugin {
  static get description() {
    return 'The <code>DiscordCheater</code> plugin will log suspected Cheaters to a Discord channel.';
  }

  static get defaultEnabled() {
    return true;
  }

  static get optionsSpecification() {
    return {
      ...DiscordBasePlugin.optionsSpecification,
      pingGroups: {
        required: true,
        description: 'A list of Discord role IDs to ping.',
        default: [],
        example: ['500455137626554379'],
      },
      enableFullLog: {
        required: true,
        description: 'Should the full log be sent to Discord.',
        example: true,
      },
      enableEmbed: {
        required: true,
        description: 'Should the embed be sent to Discord.',
        example: true,
      },
      color: {
        required: false,
        description: 'The color of the embed.',
        default: 16711680,
      },
      channelID: {
        required: false,
        description: 'The ID of the channel to send messages to.',
        default: '',
        example: '667741905228136459',
      },
      warnInGameAdmins: {
        required: true,
        description:
          'Should in-game admins be warned if a Suspected Cheater is detected.',
        example: false,
      },
      interval: {
        required: true,
        description: 'Frequency of the cheater checks in milliseconds.',
        example: 5 * 60 * 1000,
      },
      explosionThreshold: {
        required: true,
        description: 'Explosion Detection Threshold.',
        example: 200,
      },
      serverMoveTimeStampExpiredThreshold: {
        required: true,
        description: 'ServerMoveTimeStampExpired Detection Threshold.',
        example: 3000,
      },
      /*       clientNetSpeedThreshold: {
        required: true,
        description: 'Client Net Speed Threshold.',
        example: 18000
      }, */
      knifeWoundsThreshold: {
        required: true,
        description: 'Knife Wounds Detection Threshold.',
        example: 15,
      },
      fobHitsThreshold: {
        required: true,
        description: 'FOB Hits Detection Threshold.',
        example: 50,
      },
      liveThreshold: {
        required: true,
        description: 'Server Live Player Threshold',
        example: 50,
      },
      seedingMinThreshold: {
        required: true,
        description: 'Server Minimum Player Count for Seeding',
        example: 5,
      },
    };
  }

  constructor(server, options, connectors) {
    super(server, options, connectors);
    // Set to store unique rows
    this.uniqueRowsSet = new Set();
    this.cheaterCheck = this.cheaterCheck.bind(this);
  }

  async mount() {
    this.checkVersion();
    this.cheaterCheck = setInterval(this.cheaterCheck, this.options.interval);
  }

  async unmount() {
    clearInterval(this.interval);
  }

  // Check if current version is the latest version
  async checkVersion() {
    const owner = 'IgnisAlienus';
    const repo = 'SquadJS-Cheater-Detection';
    const currentVersion = 'v1.4.2';

    try {
      const latestVersion = await getLatestVersion(owner, repo);

      if (currentVersion < latestVersion) {
        this.verbose(
          1,
          'A new version is available. Please update your plugin.'
        );
        this.sendDiscordMessage({
          content: `A new version of \`SquadJS-Cheater-Detection\` is available. Please update your plugin.\nCurrent version: \`${currentVersion}\` [Latest version](https://github.com/IgnisAlienus/SquadJS-Cheater-Detection/releases): \`${latestVersion}\``,
        });
      } else if (currentVersion > latestVersion) {
        this.verbose(
          1,
          'You are running a newer version than the latest version.'
        );
        this.sendDiscordMessage({
          content: `You are running a newer version of \`SquadJS-Cheater-Detection\` than the latest version.\nThis likely means you are running a pre-release version.\nCurrent version: \`${currentVersion}\` [Latest version](https://github.com/IgnisAlienus/SquadJS-Cheater-Detection/releases): \`${latestVersion}\``,
        });
      } else if (currentVersion === latestVersion) {
        this.verbose(1, 'You are running the latest version.');
      } else {
        this.verbose(1, 'Unable to check for updates.');
      }
    } catch (error) {
      this.verbose(1, 'Error retrieving the latest version:', error);
    }
  }

  async cheaterCheck() {
    const logDirectory = this.server.options.logDir;
    console.log(this.server.options.logDir);
    const logFile = fs
      .readdirSync(logDirectory)
      .find((f) => f.endsWith('SquadGame.log'));

    if (!logFile) {
      this.verbose(1, 'No log file found.');
      return;
    }

    this.verbose(1, `Log found: ${logFile}`);

    const logPath = path.join(logDirectory, logFile);
    const fileNameNoExt = logFile.replace(/\.[^\.]+$/, '');

    try {
      await fs.promises.access(logPath, fs.constants.R_OK);
    } catch (error) {
      this.verbose(
        1,
        `\n\x1b[1m\x1b[34mUnable to read: \x1b[32m${fileNameNoExt}\x1b[0m`
      );
    }

    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    const options = {
      ENABLE_TSEXPIRED_DELTA_CHECK: true,
      PLAYER_CONTROLLER_FILTER: '', // To move to a better place. Set to a real player controller value like BP_PlayerController_C_2146648925 to filter the graph (partially implemented)
      LIVE_THRESHOLD: this.options.liveThreshold,
      SEEDING_MIN_THRESHOLD: this.options.seedingMinThreshold,
    };

    const data = new DataStore();
    const analyzer = new Analyzer(data, options);

    analyzer.on('close', (data) => {
      if (!data.getVar('ServerName')) data.setVar('ServerName', fileNameNoExt);

      const serverUptimeMs =
        +data.timePoints[data.timePoints.length - 1].time -
        +data.timePoints[0].time;
      const serverUptimeHours = (serverUptimeMs / 1000 / 60 / 60).toFixed(1);

      const startTime = data.getVar('AnalysisStartTime');
      const totalEndTime = Date.now();
      data.setVar('TotalEndTime', totalEndTime);
      const analysisDuration = data.getVar('AnalysisDuration');

      const totalDurationMs = totalEndTime - startTime;
      const totalDuration = (totalDurationMs / 1000).toFixed(1);
      data.setVar('TotalDurationMs', totalDurationMs);
      data.setVar('TotalDuration', totalDuration);

      const liveTime = (data.getVar('ServerLiveTime') / 1000 / 60 / 60).toFixed(
        1
      );
      const seedingTime = (
        data.getVar('ServerSeedingTime') /
        1000 /
        60 /
        60
      ).toFixed(1);

      let contentBuilding = [];
      contentBuilding.push({
        row: `### ${data.getVar(
          'ServerName'
        )} SERVER STAT REPORT: ${fileNameNoExt} ###`,
      });
      contentBuilding.push({
        row: `# == Server CPU: ${data.getVar('ServerCPU')}`,
      });
      contentBuilding.push({
        row: `# == Server OS: ${data.getVar('ServerOS')}`,
      });
      contentBuilding.push({
        row: `# == Squad Version: ${data.getVar('ServerVersion')}`,
      });
      contentBuilding.push({
        row: `# == Server Uptime: ${serverUptimeHours} h`,
      });
      contentBuilding.push({ row: `# == Server Seeding Time: ${seedingTime}` });
      contentBuilding.push({ row: `# == Server Live Time: ${liveTime}` });
      contentBuilding.push({
        row: `# == Host Closed Connections: ${data
          .getCounterData('hostClosedConnection')
          .map((e) => e.y / 3)
          .reduce((acc, curr) => acc + curr, 0)}`,
      });
      contentBuilding.push({
        row: `# == Failed Queue Connections: ${data
          .getCounterData('queueDisconnections')
          .map((e) => e.y / 3)
          .reduce((acc, curr) => acc + curr, 0)}`,
      });
      contentBuilding.push({
        row: `# == Steam Empty Tickets: ${data
          .getCounterData('steamEmptyTicket')
          .map((e) => e.y)
          .reduce((acc, curr) => acc + curr, 0)}`,
      });
      /*       contentBuilding.push({
        row: `# == Unique Client NetSpeed Values: ${[
          ...data.getVar('UniqueClientNetSpeedValues').values()
        ].join('; ')}`
      }); */
      contentBuilding.push({
        row: `# == Accepted Connection Lines (Cap is 50,000): ${data
          .getCounterData('AcceptedConnection')
          .map((e) => Math.round(e.y * 1000))
          .reduce((acc, curr) => acc + curr, 0)}`,
      });
      contentBuilding.push({
        row: `# == Analysis duration: ${analysisDuration}s`,
      });
      contentBuilding.push({ row: `# == Total duration: ${totalDuration}s` });
      contentBuilding.push({
        row: `### ${data.getVar(
          'ServerName'
        )} SUSPECTED CHEATER REPORT: ${fileNameNoExt} ###`,
      });

      this.verbose(
        1,
        `\n\x1b[1m\x1b[34m### ${data.getVar(
          'ServerName'
        )} SERVER STAT REPORT: \x1b[32m${fileNameNoExt}\x1b[34m ###\x1b[0m`
      );
      this.verbose(
        1,
        `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31mServer Name:\x1b[0m ${data.getVar(
          'ServerName'
        )}`
      );
      this.verbose(
        1,
        `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31mServer CPU:\x1b[0m ${data.getVar(
          'ServerCPU'
        )}`
      );
      this.verbose(
        1,
        `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31mServer OS:\x1b[0m ${data.getVar(
          'ServerOS'
        )}`
      );
      this.verbose(
        1,
        `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31mSquad Version:\x1b[0m ${data.getVar(
          'ServerVersion'
        )}`
      );
      this.verbose(
        1,
        `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31mServer Uptime:\x1b[0m ${serverUptimeHours} h`
      );
      this.verbose(
        1,
        `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31mServer Live Time:\x1b[0m ${liveTime} h`
      );
      this.verbose(
        1,
        `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31mServer Seeding Time:\x1b[0m ${seedingTime} h`
      );
      this.verbose(
        1,
        `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31mHost Closed Connections:\x1b[0m ${data
          .getCounterData('hostClosedConnection')
          .map((e) => e.y / 3)
          .reduce((acc, curr) => acc + curr, 0)}`
      );
      this.verbose(
        1,
        `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31mFailed Queue Connections:\x1b[0m ${data
          .getCounterData('queueDisconnections')
          .map((e) => e.y / 3)
          .reduce((acc, curr) => acc + curr, 0)}`
      );
      this.verbose(
        1,
        `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31mSteam Empty Tickets:\x1b[0m ${data
          .getCounterData('steamEmptyTicket')
          .map((e) => e.y)
          .reduce((acc, curr) => acc + curr, 0)}`
      );
      /*       this.verbose(
        1,
        `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31mUnique Client NetSpeed Values:\x1b[0m ${[
          ...data.getVar('UniqueClientNetSpeedValues').values()
        ].join('; ')}`
      ); */
      this.verbose(
        1,
        `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31mAccepted Connection Lines (Cap is 50,000):\x1b[0m ${data
          .getCounterData('AcceptedConnection')
          .map((e) => Math.round(e.y * 1000))
          .reduce((acc, curr) => acc + curr, 0)}`
      );
      this.verbose(
        1,
        `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31mAnalysis duration:\x1b[0m ${analysisDuration}s`
      );
      this.verbose(
        1,
        `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31mTotal duration:\x1b[0m ${totalDuration}s`
      );
      this.verbose(
        1,
        `\x1b[1m\x1b[34m### CHEATING REPORT: \x1b[32m${data.getVar(
          'ServerName'
        )}\x1b[34m ###\x1b[0m`
      );
      const cheaters = {
        Explosions: data.getVar('explosionCountersPerController'),
        ServerMoveTimeStampExpired: data.getVar(
          'serverMoveTimestampExpiredPerController'
        ),
        //ClientNetSpeed: data.getVar('playerControllerToNetspeed'),
        KnifeWounds: data.getVar('knifeWoundsPerPlayerController'),
        FOBHits: data.getVar('fobHitsPerController'),
      };

      let suspectedCheaters = new Set();
      for (let cK in cheaters) {
        let minCount = 200;
        switch (cK) {
          case 'Explosions':
            if (this.options.explosionThreshold === 0) {
              break;
            } else {
              minCount = this.options.explosionThreshold;
              break;
            }
          case 'ServerMoveTimeStampExpired':
            if (this.options.serverMoveTimeStampExpiredThreshold === 0) {
              break;
            } else {
              minCount = this.options.serverMoveTimeStampExpiredThreshold;
              break;
            }
          /* case 'ClientNetSpeed':
            if (this.options.clientNetSpeedThreshold === 0) {
              break;
            } else {
              minCount = this.options.clientNetSpeedThreshold;
              break;
            } */
          case 'KnifeWounds':
            if (this.options.knifeWoundsThreshold === 0) {
              break;
            } else {
              minCount = this.options.knifeWoundsThreshold;
              break;
            }
          case 'FOBHits':
            if (this.options.fobHitsThreshold === 0) {
              break;
            } else {
              minCount = this.options.fobHitsThreshold;
              break;
            }
        }

        contentBuilding.push({ row: `# == ${cK.toUpperCase()}` });
        this.verbose(
          1,
          `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[31m${cK.toUpperCase()}\x1b[0m`
        );

        for (let playerId in cheaters[cK]) {
          const referenceValue = cheaters[cK][playerId];
          if (
            (typeof referenceValue === 'number' && referenceValue > minCount) ||
            (typeof referenceValue === 'object' &&
              referenceValue.find((v) => v > minCount))
          ) {
            let playerName;
            let playerSteamID;
            let playerController;

            playerController = playerId;
            const playerControllerToPlayerName = data.getVar(
              'playerControllerToPlayerName'
            );
            const playerControllerToSteamID = data.getVar(
              'playerControllerToSteamID'
            );
            playerName = playerControllerToPlayerName[playerController];
            playerSteamID = playerControllerToSteamID[playerController];

            const row = `#  > ${playerSteamID} | ${playerController} | ${playerName}: ${cheaters[cK][playerId]}`;

            // Check if the row is already in the set
            if (!this.uniqueRowsSet.has(row)) {
              suspectedCheaters.add(playerSteamID);
              this.uniqueRowsSet.add(row);
              contentBuilding.push({ row });
              this.verbose(
                1,
                `\x1b[1m\x1b[34m#\x1b[0m  > \x1b[33m${playerSteamID}\x1b[90m ${playerController}\x1b[37m ${playerName}\x1b[90m: \x1b[91m${cheaters[cK][playerId]}\x1b[0m`
              );
            }
          }
        }
      }
      if (suspectedCheaters.size === 0) {
        this.verbose(
          1,
          `\x1b[1m\x1b[34m### NO SUSPECTED CHEATERS FOUND: \x1b[32m${data.getVar(
            'ServerName'
          )}\x1b[34m ###\x1b[0m`
        );
        return;
      } else {
        contentBuilding.push({
          row: `### SUSPECTED CHEATERS SESSIONS: ${data.getVar(
            'ServerName'
          )} ###`,
        });
        this.verbose(
          1,
          `\x1b[1m\x1b[34m### SUSPECTED CHEATERS SESSIONS: \x1b[32m${data.getVar(
            'ServerName'
          )}\x1b[34m ###\x1b[0m`
        );
        let suspectedCheatersNames = [];
        for (let playerSteamID of suspectedCheaters) {
          const disconnectionTimesByPlayerController = data.getVar(
            'disconnectionTimesByPlayerController'
          );
          const connectionTimesByPlayerController = data.getVar(
            'connectionTimesByPlayerController'
          );
          const explosionCountersPerController = data.getVar(
            'explosionCountersPerController'
          );
          const serverMoveTimestampExpiredPerController = data.getVar(
            'serverMoveTimestampExpiredPerController'
          );
          const playerControllerToNetspeed = data.getVar(
            'playerControllerToNetspeed'
          );
          const killsPerPlayerController = data.getVar(
            'killsPerPlayerController'
          );
          const knifeWoundsPerPlayerController = data.getVar(
            'knifeWoundsPerPlayerController'
          );
          const fobHitsPerController = data.getVar('fobHitsPerController');
          const steamIDToPlayerController = data.getVar(
            'steamIDToPlayerController'
          );
          const playerControllerHistory =
            steamIDToPlayerController.get(playerSteamID);
          if (!playerControllerHistory) continue;
          const playerControllerToPlayerName = data.getVar(
            'playerControllerToPlayerName'
          );
          let playerName =
            playerControllerToPlayerName[playerControllerHistory[0]];
          suspectedCheatersNames.push(playerName);

          contentBuilding.push({
            row: `# == ${playerSteamID} | ${playerName}`,
          });
          this.verbose(
            1,
            `\x1b[1m\x1b[34m#\x1b[0m == \x1b[1m\x1b[33m${playerSteamID} \x1b[37m${playerName}\x1b[90m`
          );

          for (let playerController of playerControllerHistory) {
            let stringifiedConnectionTime =
              connectionTimesByPlayerController[
                playerController
              ].toLocaleString();
            let stringifiedDisconnectionTime =
              disconnectionTimesByPlayerController[
                playerController
              ]?.toLocaleString() || 'N/A';

            contentBuilding.push({
              row: `#  >  ${playerController}: (${stringifiedConnectionTime} - ${stringifiedDisconnectionTime})`,
            });
            contentBuilding.push({
              row: `#  >>>>>${
                explosionCountersPerController[playerController] || 0
              } Explosions, ${
                serverMoveTimestampExpiredPerController[playerController] || 0
              } ServerMoveTimeStampExpired, ${
                killsPerPlayerController[playerController] || 0
              } Kills, ${
                knifeWoundsPerPlayerController[playerController] || 0
              } Knife Wounds, ${
                fobHitsPerController[playerController] || 0
              } FOB Hits`,
            });
            this.verbose(
              1,
              `\x1b[1m\x1b[34m#\x1b[0m  > \x1b[90m ${playerController}\x1b[90m: \x1b[37m(${stringifiedConnectionTime} - ${stringifiedDisconnectionTime})\x1b[90m`
            );
            this.verbose(
              1,
              `\x1b[1m\x1b[34m#\x1b[0m  >>>>> \x1b[91m${
                explosionCountersPerController[playerController] || 0
              } Explosions, ${
                serverMoveTimestampExpiredPerController[playerController] || 0
              } ServerMoveTimeStampExpired, ${
                killsPerPlayerController[playerController] || 0
              } Kills, ${
                knifeWoundsPerPlayerController[playerController] || 0
              } Knife Wounds, ${
                fobHitsPerController[playerController] || 0
              } FOB Hits\x1b[0m`
            );

            if (this.options.enableEmbed) {
              const markdownField = `\`\`\`# == ${playerSteamID} | ${playerName}
# > ${playerController}: (${stringifiedConnectionTime} - ${stringifiedDisconnectionTime}
#  >>>>>${explosionCountersPerController[playerController] || 0} Explosions
#  >>>>>${
                serverMoveTimestampExpiredPerController[playerController] || 0
              } ServerMoveTimeStampExpired
#  >>>>>${killsPerPlayerController[playerController] || 0} Kills
#  >>>>>${knifeWoundsPerPlayerController[playerController] || 0} Knife Wounds
#  >>>>>${fobHitsPerController[playerController] || 0} FOB Hits
\`\`\``;
              const message = {
                embed: {
                  title: `Suspected Cheater Identified`,
                  description: `*Suspected* Cheaters are not always Cheaters. Always verify with recorded in-game footage if possible. Get with https://discord.gg/onlybans to go over the results in more detail if you are not sure.`,
                  color: this.options.color,
                  fields: [
                    {
                      name: 'SteamID',
                      value: `[${playerSteamID}](https://steamcommunity.com/profiles/${playerSteamID})`,
                      inline: true,
                    },
                    {
                      name: 'Player Name',
                      value: playerName,
                      inline: true,
                    },
                    {
                      name: 'Battlemetrics Player Profile',
                      value: `[Battlemetris Player Profile](https://www.battlemetrics.com/rcon/players?filter[search]=${playerSteamID}&method=quick&redirect=1)`,
                      inline: false,
                    },
                    {
                      name: 'Suspected Cheater Data',
                      value: markdownField,
                      inline: false,
                    },
                  ],
                  timestamp: new Date(),
                },
              };

              this.sendDiscordMessage(message);
            }
          }
        }

        const unidentifiedPawns = data.getVar('UnidentifiedPawns');
        if (unidentifiedPawns?.size > 0) {
          this.verbose(
            1,
            `\x1b[1m\x1b[34m### UNIDENTIFIED PAWNS: \x1b[32m${data.getVar(
              'ServerName'
            )}\x1b[34m ###\x1b[0m`
          );
          contentBuilding.push({
            row: `#### UNIDENTIFIED PAWNS: ${data.getVar('ServerName')} ###`,
          });
          for (let pawn of unidentifiedPawns) {
            this.verbose(
              1,
              `\x1b[ 1m\x1b[ 34m#\x1b[ 0m == \x1b[ 1m${pawn} \x1b[ 0m`
            );
            contentBuilding.push({ row: `# == ${pawn}` });
          }
        }
        contentBuilding.push({
          row: `#### FINISHED ALL REPORTS: ${data.getVar('ServerName')} ###`,
        });
        this.verbose(
          1,
          `\x1b[1m\x1b[34m### FINISHED ALL REPORTS: \x1b[32m${data.getVar(
            'ServerName'
          )}\x1b[34m ###\x1b[0m`
        );

        let pingables = 'Supsected Cheater Report for Review';
        if (this.options.pingGroups.length > 0) {
          pingables = this.options.pingGroups
            .map((groupID) => `<@&${groupID}>`)
            .join(' ');
        }

        const maxCharacterLimit = 2000;
        let currentMessage = '';

        this.sendDiscordMessage({
          content: `${pingables}\nJust because a "SUSPECTED CHEATER" is list in the Output does NOT *always* guarantee they are a Cheater. Verify with recorded in-game footage if possible. Get with https://discord.gg/onlybans to go over the results in more detail if you are not sure.\n\nFor more information on what each line means in the output, please visit: https://www.guardianonlybans.com/logcheck-info`,
        });

        if (this.options.enableFullLog) {
          for (const item of contentBuilding) {
            const row = item.row + '\n';

            if (currentMessage.length + row.length <= maxCharacterLimit) {
              // If adding the row doesn't exceed the character limit, add it to the current message
              currentMessage += row;
            } else {
              // If adding the row exceeds the character limit, send the current message
              this.sendDiscordMessage({
                content: `\`\`\`\n${currentMessage}\n\`\`\``,
              });

              // Start a new message with the current row
              currentMessage = row;
            }
          }

          // Send the remaining message if any
          if (currentMessage.length > 0) {
            this.sendDiscordMessage({
              content: `\`\`\`\n${currentMessage}\n\`\`\``,
            });
          }
        }

        this.warnInGameAdmins(suspectedCheatersNames);
      }
    });

    rl.on('line', (line) => {
      analyzer.emit('line', line);
    });

    rl.on('close', () => {
      analyzer.close();
    });
    rl.on('error', (err) => {
      this.verbose(1, err);
    });

    await analyzer.analyze();
  }

  async warnInGameAdmins(suspectedCheatersNames) {
    const admins = await this.server.getAdminsWithPermission('canseeadminchat');
    let amountAdmins = 0;
    for (const player of this.server.players) {
      if (!admins.includes(player.steamID)) continue;
      amountAdmins++;

      if (this.options.warnInGameAdmins) {
        const cheatersList = [...suspectedCheatersNames].join('\n'); // Convert Set to array and join elements
        await this.server.rcon.warn(
          player.steamID,
          `Suspected Cheater(s) Found!\n${cheatersList}`
        );
      }
    }
  }
}

// Retrieve the latest version from GitHub
async function getLatestVersion(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  const response = await fetch(url);
  const data = await response.json();
  return data.tag_name;
}
