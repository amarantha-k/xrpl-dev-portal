---
html: run-rippled-in-reporting-mode.html
parent: configure-rippled.html
blurb: Run a special operating mode of rippled that handles remote procedure calls (RPC) for validated data.
labels:
  - Core Server
  - Blockchain
top_nav_grouping: Popular Pages
---
# Run rippled in Reporting Mode

[Reporting mode](rippled-server-modes.html) is a mode of the XRP Ledger core server specialized for serving [HTTP and WebSocket APIs](rippled-api.html).

In reporting mode, the server does not connect to the peer-to-peer network. Instead, it uses gRPC to get validated data from one or more trusted servers that are connected to the P2P network. 
It can then efficiently handle RPCs, reducing the load on rippled nodes running in P2P mode.

Fig: High-level illustration of how reporting mode works

The reporting mode of rippled uses two datastores:
The primary persistent datastore for rippled that includes transaction metadata, account states, and ledger headers. You can use NuDB or Cassandra as the primary persistent datastore.
Postgres database to hold relational data, which is used mainly by tx and account_tx. 

When a reporting mode server receives an API request, it loads the data from these data stores if possible. For requests that require data from the P2P network, the reporting mode forwards the request to a P2P server, and then passes the response back to the client.

Multiple reporting mode servers can share access to the same network accessible databases (PostgreSQL and Cassandra); at any given time, only one reporting mode server writes to the databases, while all the others read from the databases. 

## How to Run Reporting Mode

### Prerequisites

1. Ensure that your system meets the [system requirements](system-requirements.html).

    **Note:** If you choose to use Cassandra as the database, the disk requirements for rippled will be lower as the data will not be stored on your local disk.  

2. In order to run reporting mode, you also need to run one or more rippled nodes in P2P mode. Ensure that you have at least one rippled node running in P2P mode. 

3. Install and configure the datastores required to run rippled in reporting mode. 

    a. Install Postgres. 

        brew install postgres
        brew services start postgres
        psql postgres
	        CREATE ROLE newUser WITH LOGIN PASSWORD ‘password’;
            ALTER ROLE newUser CREATEDB;
        \q
        psql postgres -U newuser
        postgres=# create database reporting;

    b. Install and configure the database to be used as the primary persistent datastore. You can choose to use Cassandra or NuDB. 

        *Cassandra*: Install Cassandra and then create a keyspace for rippled, with replication. While a replication factor of 3 is recommended, when running locally, replication is not needed and you can set `replication_factor` to 1.    
        
            $ cqlsh [host] [port]
            > CREATE KEYSPACE rippled WITH REPLICATION =
            {'class' : 'SimpleStrategy', 'replication_factor' : 1    };

        *NuDB*: If you’re running rippled in reporting mode for your local network, you can choose to use NuDB instead of Cassandra as your backend database. NuDB is installed as part of your rippled build setup and does not require any additional installation steps.

    c. On macOS, you need to manually install the Cassandra cpp driver. On all other platforms, the Cassandra driver is built as part of the `rippled` build. 
        
        brew install cassandra-cpp-driver

### Procedure

1. Build rippled for reporting mode. 
Complete instructions to build and run rippled are available on https://xrpl.org/build-run-rippled-macos.html.

    a. Clone the rippled repository: 

        git clone https://github.com/ripple/rippled.git

    b. Access the repository on your local:

        cd rippled

    c. Create a build directory and access it:

        mkdir my_build
        cd my_build

    d. Build rippled for reporting mode: 

        cmake -G "Unix Makefiles" -Dreporting=ON -DCMAKE_BUILD_TYPE=Debug ..

    e. Run the build using CMake:

        cmake --build . -- -j 4

2. Create a configuration file to run rippled in reporting mode. 

    Make a copy of the example config file, `rippled.cfg`, and save it as `reporting-mode.cfg` in a location that enables you to run `rippled` as a non-root user. For example:
    
        cd /etc/opt/ripple/

        mkdir -p $HOME/.config/ripple

        cp cfg/rippled-example.cfg $HOME/.config/ripple/rippled-reporting-mode.cfg

3. Edit rippled-reporting-mode.cfg to set necessary file paths. The user you plan to run rippled as must have write permissions to all of the paths you specify here.

    a. Set the [node_db] path to the location where you want to store the ledger database.

    b. Set the [database_path] to the location where you want to store other database data. (This includes an SQLite database with configuration data, and is typically one level above the [node_db] path field.)
        
    c. Set the [debug_logfile] to a path where rippled can write logging information.

Note that these are the only configurations required for rippled to start up successfully. All other configurations are optional and can be tweaked after you have a working server.

4. Edit rippled-reporting-mode.cfg to enable Reporting Mode by updating the [Reporting ] stanza in your rippled.cfg. 

    a. Uncomment the `[reporting]` stanza or add a new one:

        [reporting]
        etl_source
        read_only=0

    b. List the rippled sources (ETL sources) to extract data from:
        
        [etl_source]
        source_grpc_port=50051
        source_ws_port=6006
        source_ip=127.0.0.1

5. Configure the databases

    a. Specify the Postgres DB for ledger_tx_tables:

        [ledger_tx_tables]
        conninfo = postgres://newuser:password@127.0.0.1/reporting
        use_tx_tables=1

    b. Specify the database for node_db.

    <!-- MULTICODE_BLOCK_START -->

    *NuDB*

        [node_db]
        type=NuDB
        path=/home/ubuntu/ripple/

        [ledger_history]
        1000000

    *Cassandra*

        [node_db]
        type=Cassandra
        path=

        [ledger_history]
        1000000

    <!-- MULTICODE_BLOCK_START -->

6. Modify the configuration for rippled to open up ports

    a. Open the public websocket port:

            [port_ws_admin_local]
            port = 6006
            ip = 127.0.0.1
            admin = 127.0.0.1
            protocol = ws


    b. Open the gRPC port:

            [port_grpc]
            port = 60051
            ip = 0.0.0.0


    c. Add a secured gateway to the IP of your reporting system:

            secure_gateway = 127.0.0.1

7. Run rippled in reporting mode:

    ./rippled --conf /home/ubuntu/.config/ripple/rippled-reporting-example.cfg


### What to Expect

Here are the excerpts of what you can expect to see on your terminal.

```text
Loading: "/home/ubuntu/.config/ripple/rippled-reporting-example.cfg"
2021-Dec-09 21:31:52.245577 UTC JobQueue:NFO Using 10  threads
2021-Dec-09 21:31:52.255422 UTC LedgerConsensus:NFO Consensus engine started (cookie: 17859050541656985684)
2021-Dec-09 21:31:52.256542 UTC ReportingETL::ETLSource:NFO Using IP to connect to ETL source: 127.0.0.1:50051
2021-Dec-09 21:31:52.257784 UTC ReportingETL::ETLSource:NFO Made stub for remote = { validated_ledger :  , ip : 127.0.0.1 , web socket port : 6006, grpc port : 50051 }
2021-Dec-09 21:31:52.258032 UTC ReportingETL::LoadBalancer:NFO add : added etl source - { validated_ledger :  , ip : 127.0.0.1 , web socket port : 6006, grpc port : 50051 }
2021-Dec-09 21:31:52.258327 UTC Application:NFO process starting: rippled-1.8.1+DEBUG
2021-Dec-09 21:31:52.719186 UTC PgPool:DBG max_connections: 18446744073709551615, timeout: 600, connection params: port: 5432, hostaddr: 127.0.0.1, user: newuser, password: *, channel_binding: prefer, dbname: reporting_test_core, host: 127.0.0.1, options: , sslmode: prefer, sslcompression: 0, sslsni: 1, ssl_min_protocol_version: TLSv1.2, gssencmode: prefer, krbsrvname: postgres, target_session_attrs: any
2021-Dec-09 21:31:52.788851 UTC PgPool:NFO server message: NOTICE:  relation "version" already exists, skipping

2021-Dec-09 21:31:53.282807 UTC TaggedCache:DBG LedgerCache target size set to 384
2021-Dec-09 21:31:53.282892 UTC TaggedCache:DBG LedgerCache target age set to 240000000000
2021-Dec-09 21:31:53.283741 UTC Amendments:DBG Amendment 98DECF327BF79997AEC178323AD51A830E457BFC6D454DAF3E46E5EC42DC619F (CheckCashMakesTrustLine) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.283836 UTC Amendments:DBG Amendment 157D2D480E006395B76F948E3E07A45A05FE10230D88A7993C71F97AE4B1F2D1 (Checks) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.283917 UTC Amendments:DBG Amendment 1562511F573A19AE9BD103B5D6B9E01B3B46805AEC5D3C4805C902B514399146 (CryptoConditions) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.283975 UTC Amendments:DBG Amendment 86E83A7D2ECE3AD5FA87AB2195AE015C950469ABF0B72EAACED318F74886AE90 (CryptoConditionsSuite) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284016 UTC Amendments:DBG Amendment 30CD365592B8EE40489BA01AE2F7555CAC9C983145871DC82A42A31CF5BAE7D9 (DeletableAccounts) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284062 UTC Amendments:DBG Amendment F64E1EABBE79D55B3BB82020516CEC2C582A98A6BFE20FBE9BB6A0D233418064 (DepositAuth) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284099 UTC Amendments:DBG Amendment 3CBC5C4E630A1B82380295CDA84B32B49DD066602E74E39B85EF64137FA65194 (DepositPreauth) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284126 UTC Amendments:DBG Amendment DC9CA96AEA1DCF83E527D1AFC916EFAF5D27388ECA4060A88817C1238CAEE0BF (EnforceInvariants) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284153 UTC Amendments:DBG Amendment 07D43DCE529B15A10827E5E04943B496762F9A88E3268269D69C44BE49E21104 (Escrow) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284189 UTC Amendments:DBG Amendment 42426C4D4F1009EE67080A9B7965B44656D7714D104A72F9B4369F97ABF044EE (FeeEscalation) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284216 UTC Amendments:DBG Amendment 740352F2412A9909880C23A559FCECEDA3BE2126FED62FC7660D628A06927F11 (Flow) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284241 UTC Amendments:DBG Amendment 3012E8230864E95A58C60FD61430D7E1B4D3353195F2981DC12B0C7C0950FFAC (FlowCross) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284284 UTC Amendments:DBG Amendment AF8DF7465C338AE64B1E937D6C8DA138C0D63AD5134A68792BBBE1F63356C422 (FlowSortStrands) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284337 UTC Amendments:DBG Amendment 1F4AFA8FA1BC8827AD4C0F682C03A8B671DCDF6B5C4DE36D44243A684103EF88 (HardenedValidations) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284412 UTC Amendments:DBG Amendment 4C97EBA926031A7CF7D7B36FDE3ED66DDA5421192D63DE53FFB46E43B9DC8373 (MultiSign) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284455 UTC Amendments:DBG Amendment 586480873651E106F1D6339B0C4A8945BA705A777F3F4524626FF1FC07EFE41D (MultiSignReserve) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284491 UTC Amendments:DBG Amendment B4E4F5D2D6FB84DF7399960A732309C9FD530EAE5941838160042833625A6076 (NegativeUNL) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284528 UTC Amendments:DBG Amendment 08DE7D96082187F6E6578530258C77FAABABE4C20474BDB82F04B021F1A68647 (PayChan) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284592 UTC Amendments:DBG Amendment 00C1FC4A53E60AB02C864641002B3172F38677E29C26C5406685179B37E1EDAC (RequireFullyCanonicalSig) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284649 UTC Amendments:DBG Amendment CC5ABAE4F3EC92E94A59B1908C2BE82D2228B6485C00AFF8F22DF930D89C194E (SortedDirectories) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284703 UTC Amendments:DBG Amendment 532651B4FD58DF8922A49BA101AB3E996E5BFBF95A913B3E392504863E63B164 (TickSize) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284787 UTC Amendments:DBG Amendment 955DF3FA5891195A9DAEFA1DDC6BB244B545DDE1BAA84CBB25D5F12A8DA68A0C (TicketBatch) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284950 UTC Amendments:DBG Amendment 6781F8368C4771B83E8B821D88F580202BCB4228075297B19E4FDC5233F1EFDC (TrustSetAuth) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.284997 UTC Amendments:DBG Amendment B4D44CC3111ADD964E846FC57760C8B50FFCD5A82C86A72756F6B058DDDF96AD (fix1201) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285025 UTC Amendments:DBG Amendment E2E6F2866106419B88C50045ACE96368558C345566AC8F2BDF5A5B5587F0E6FA (fix1368) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285067 UTC Amendments:DBG Amendment 42EEA5E28A97824821D4EF97081FE36A54E9593C6E4F20CBAE098C69D2E072DC (fix1373) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285103 UTC Amendments:DBG Amendment 6C92211186613F9647A89DFFBAB8F94C99D4C7E956D495270789128569177DA1 (fix1512) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285129 UTC Amendments:DBG Amendment 67A34F2CF55BFC0F93AACD5B281413176FEE195269FA6D95219A2DF738671172 (fix1513) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285153 UTC Amendments:DBG Amendment 5D08145F0A4983F23AFFFF514E83FAD355C5ABFBB6CAB76FB5BC8519FF5F33BE (fix1515) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285176 UTC Amendments:DBG Amendment B9E739B8296B4A1BB29BE990B17D66E21B62A300A909F25AC55C22D6C72E1F9D (fix1523) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285202 UTC Amendments:DBG Amendment 1D3463A5891F9E589C5AE839FFAC4A917CE96197098A1EF22304E1BC5B98A454 (fix1528) is supported and will be down voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285256 UTC Amendments:DBG Amendment CA7C02118BA27599528543DFE77BA6838D1B0F43B447D4D7F53523CE6A0E9AC2 (fix1543) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285290 UTC Amendments:DBG Amendment 7117E2EC2DBF119CA55181D69819F1999ECEE1A0225A7FD2B9ED47940968479C (fix1571) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285343 UTC Amendments:DBG Amendment FBD513F1B893AC765B78F250E6FFA6A11B573209D1842ADC787C850696741288 (fix1578) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285381 UTC Amendments:DBG Amendment 58BE9B5968C4DA7C59BA900961828B113E5490699B21877DEF9A31E9D0FE5D5F (fix1623) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285424 UTC Amendments:DBG Amendment 25BA44241B3BD880770BFA4DA21C7180576831855368CBEC6A3154FDE4A7676E (fix1781) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285464 UTC Amendments:DBG Amendment 4F46DF03559967AC60F2EB272FEFE3928A7594A45FF774B87A7E540DB0F8F068 (fixAmendmentMajorityCalc) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285500 UTC Amendments:DBG Amendment 8F81B066ED20DAECA20DF57187767685EEF3980B228E0667A650BAF24426D3B4 (fixCheckThreading) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285527 UTC Amendments:DBG Amendment C4483A1896170C66C098DEA5B0E024309C60DC960DE5F01CD7AF986AA3D9AD37 (fixMasterKeyAsRegularKey) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285550 UTC Amendments:DBG Amendment 621A0B264970359869E3C0363A899909AAB7A887C8B73519E4ECF952D33258A8 (fixPayChanRecipientOwnerDir) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285575 UTC Amendments:DBG Amendment 89308AF3B8B10B7192C4E613E1D2E4D9BA64B2EE2D5232402AE82A6A7220D953 (fixQualityUpperBound) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285614 UTC Amendments:DBG Amendment B6B3EEDC0267AB50491FDC450A398AF30DBCD977CECED8BEF2499CAB5DAC19E2 (fixRmSmallIncreasedQOffers) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285651 UTC Amendments:DBG Amendment 452F5906C46D46F407883344BFDD90E672B672C5E9943DB4891E3A34FEEEB9DB (fixSTAmountCanonicalize) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.285725 UTC Amendments:DBG Amendment 2CD5286D8D687E98B41102BDD797198E81EA41DF7BD104E6561FEB104EFF2561 (fixTakerDryOfferRemoval) is supported and will be up voted if not enabled on the ledger.
2021-Dec-09 21:31:53.290446 UTC Server:NFO Opened 'port_rpc_admin_local' (ip=127.0.0.1:7005, admin IPs:127.0.0.1, http)
2021-Dec-09 21:31:53.290834 UTC Server:NFO Opened 'port_ws_admin_local' (ip=127.0.0.1:7006, admin IPs:127.0.0.1, ws)
2021-Dec-09 21:31:53.290984 UTC Application:WRN Running in standalone mode
2021-Dec-09 21:31:53.291048 UTC NetworkOPs:NFO STATE->full
2021-Dec-09 21:31:53.291192 UTC Application:FTL Startup RPC: 
{
	"command" : "log_level",
	"severity" : "debug"
}


2021-Dec-09 21:31:53.291347 UTC RPCHandler:DBG RPC call log_level completed in 2.2e-08seconds
2021-Dec-09 21:31:53.291440 UTC Application:FTL Result: 
{
	"warnings" : 
	[
		
		{
			"id" : 1004,
			"message" : "This is a reporting server.  The default behavior of a reporting server is to only return validated data. If you are looking for not yet validated data, include \"ledger_index : current\" in your request, which will cause this server to forward the request to a p2p node. If the forward is successful the response will include \"forwarded\" : \"true\""
		}
	]
}


2021-Dec-09 21:31:53.291502 UTC ReportingETL:NFO Starting reporting etl
2021-Dec-09 21:31:53.291605 UTC Application:NFO Application starting. Version is 1.8.1+DEBUG
2021-Dec-09 21:31:53.291747 UTC LoadManager:DBG Starting
2021-Dec-09 21:31:53.291846 UTC gRPC Server:NFO Starting gRPC server at 0.0.0.0:60051
2021-Dec-09 21:31:53.293246 UTC LedgerCleaner:DBG Started
2021-Dec-09 21:31:53.295543 UTC ReportingETL::ETLSource:DBG handleMessage : Received a message on ledger  subscription stream. Message : {
   "result" : {},
   "status" : "success",
   "type" : "response"
}
 - { validated_ledger :  , ip : 127.0.0.1 , web socket port : 6006, grpc port : 50051 }
2021-Dec-09 21:31:53.368075 UTC ReportingETL:NFO monitor : Database is empty. Will download a ledger from the network.
2021-Dec-09 21:31:53.368183 UTC ReportingETL:NFO monitor : Waiting for next ledger to be validated by network...
```

## Frequently Asked Questions

### Do I need to run more than one instance of rippled in order to use Reporting mode?

Yes. A rippled node running in reporting mode does not connect to the P2P network, but instead extracts validated data from one or more rippled nodes that are connected to the P2P network. In addition to the rippled node running in reporting mode, you need to run at least one other rippled node that is connected to the P2P network. 

### I’ve already installed rippled. Can I update the configuration file to enable reporting mode and restart rippled? 

Currently, you need to download the source and build rippled for reporting mode. 
There are initiatives in progress to provide packages for reporting mode.


### To run rippled in Reporting mode, I need at least one rippled node running in P2P mode in addition to rippled in Reporting mode. Does this mean I need double the disk space? 

The answer depends on the location of your primary datastore. If you use Cassandra as the primary datastore, the disk space requirement to run rippled in reporting mode will be lower as the data is not stored on your local disk. The PostgreSQL server can be remote as well.

Lastly, the P2P mode server only needs to keep very recent history, while the reporting mode server keeps long term history.

For more information on system requirements to run rippled, see https://xrpl.org/system-requirements.html. 

### How can I confirm the validity of the data that comes from the Postgres or Cassandra database?

Rippled running in Reporting mode only serves validated data from the ETL source specified in the config file. If you are accessing someone else's rippled server in P2P mode as the ETL source, you are implicitly trusting that server. If not, you need to run your own rippled node in P2P mode.

### Is it possible to make traditional SQL queries to the relational database rather than using the API?

Technically, you *can* directly access the database if you want. However, the data is hashed as blobs and you have to decode the blobs in order to access using traditional SQL queries.